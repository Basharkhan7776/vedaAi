import {
  extractQuestions,
  extractHandwrittenAnswers,
  mapAnswersAndGrade,
  validateDocuments,
  PipelineTokenTracker,
} from "@/lib/ai/gemini";
import {
  formatGroundingForPrompt,
  runGroundedThinkingLoop,
} from "@/lib/ai/thinking-loop";
import { box2dToPct, emptyBox } from "@/lib/geometry/box";
import { rasterizeAnswerSheet } from "@/lib/pdf/rasterize";
import {
  setAnswerPages,
  setEvaluation,
  setSessionFailure,
  setSessionStage,
  getSession,
} from "@/lib/session/store";
import type {
  AnswerRegion,
  EvaluationSession,
  GroundingBrief,
  MappedQuestion,
  SessionFailure,
  UnmappedAnswer,
} from "@/lib/types/evaluation";
import type {
  ExtractAnswersResult,
  ExtractQuestionsResult,
  ValidateDocumentsResult,
} from "@/lib/ai/schemas";

export async function runEvaluationPipeline(sessionId: string): Promise<void> {
  PipelineTokenTracker.reset();

  const session = getSession(sessionId);
  if (!session?.questionPaper || !session.answerSheet) {
    console.error(`❌ [pipeline] Session ${sessionId} missing uploads`);
    setSessionFailure(sessionId, {
      title: "Missing uploads",
      summary: "Both a question paper and an answer sheet are required.",
      issues: [
        {
          file: "both",
          code: "other",
          message: "One or both files were not received by the server.",
          suggestions: [
            "Upload a PDF or image question paper",
            "Upload one student answer sheet (PDF or images)",
          ],
        },
      ],
      suggestions: ["Return to Upload and attach both files again."],
    });
    return;
  }

  const qpSizeKb = (session.questionPaper.bytes.length / 1024).toFixed(1);
  const asSizeKb = (session.answerSheet.bytes.length / 1024).toFixed(1);

  console.log(`\n======================================================`);
  console.log(`🚀 [pipeline] Starting Evaluation Session: ${sessionId}`);
  console.log(`📄 Question Paper : ${session.questionPaper.name} (${qpSizeKb} KB, ${session.questionPaper.mimeType})`);
  console.log(`📝 Answer Sheet    : ${session.answerSheet.name} (${asSizeKb} KB, ${session.answerSheet.mimeType})`);
  console.log(`======================================================\n`);

  try {
    // ------------------------------------------------------------------
    // STEP 1: Ingest & Rasterize Answer Sheet
    // ------------------------------------------------------------------
    console.log(`⏳ [pipeline] [1/6] Ingesting & rasterizing answer sheet pages...`);
    setSessionStage(sessionId, "ingest_rasterize");
    let pages;
    try {
      pages = await rasterizeAnswerSheet(session.answerSheet);
      setAnswerPages(sessionId, pages);
      console.log(`✅ [pipeline] [1/6] Rasterized ${pages.length} answer page(s) successfully.`);
    } catch (rasterErr) {
      const message =
        rasterErr instanceof Error
          ? rasterErr.message
          : "Could not read answer sheet pages";
      console.error(`❌ [pipeline] [1/6] Rasterization failed:`, message);
      setSessionFailure(sessionId, {
        title: "Answer sheet could not be read",
        summary: message,
        issues: [
          {
            file: "answerSheet",
            code: "corrupted_or_unreadable",
            message,
            suggestions: [
              "Re-export the answer sheet as a clear PDF or PNG/JPEG",
              "Ensure the file is not password-protected or corrupted",
            ],
          },
        ],
        suggestions: [
          "Re-upload a readable scan of the handwritten answer sheet.",
        ],
      });
      return;
    }

    // ------------------------------------------------------------------
    // STEP 2: Validate Document Context & Compatibility
    // ------------------------------------------------------------------
    console.log(`⏳ [pipeline] [2/6] Validating documents via Gemini AI...`);
    setSessionStage(sessionId, "validate_documents");
    const validation = await validateDocuments({
      questionPaper: session.questionPaper,
      answerSheet: session.answerSheet,
      answerPreviewPage: pages[0],
    });

    console.log(`   🔎 Validation:`, {
      qpValid: validation.questionPaper.isValidQuestionPaper,
      qpConfidence: `${validation.questionPaper.confidence}%`,
      asValid: validation.answerSheet.isValidAnswerSheet,
      asConfidence: `${validation.answerSheet.confidence}%`,
      compatible: validation.pairLooksCompatible,
    });

    if (!documentsAreUsable(validation)) {
      console.warn(`⚠️ [pipeline] [2/6] Documents failed usability validation.`);
      setSessionFailure(sessionId, toSessionFailure(validation));
      return;
    }
    console.log(`✅ [pipeline] [2/6] Documents validated successfully.`);

    // ------------------------------------------------------------------
    // STEP 3: Extract Questions & Overall Paper Metadata
    // ------------------------------------------------------------------
    console.log(`⏳ [pipeline] [3/6] Extracting exam structure, sections & max marks from Question Paper...`);
    setSessionStage(sessionId, "extract_questions");
    const extracted = await extractQuestions(session.questionPaper);

    console.log(`✅ [pipeline] [3/6] Extracted ${extracted.questions.length} questions.`);
    console.log(`   📌 Title: "${extracted.title || 'Exam Paper'}" | Subject: "${extracted.subject || 'General'}" | Grade: "${extracted.grade || 'N/A'}"`);
    if (extracted.totalPaperMarks) {
      console.log(`   🏆 Total Paper Max Marks: ${extracted.totalPaperMarks} | Duration: ${extracted.duration || 'N/A'}`);
    }
    if (extracted.sections && extracted.sections.length > 0) {
      console.log(`   📑 Sections (${extracted.sections.length}):`);
      extracted.sections.forEach((sec) => {
        console.log(`      * [${sec.name}] ${sec.title || ''} (Range: ${sec.questionRange || 'N/A'}, Marks/Q: ${sec.marksPerQuestion ?? 'N/A'}, Total: ${sec.totalMarks ?? 'N/A'}m, Compulsory: ${sec.isCompulsory})`);
      });
    }
    if (extracted.generalInstructions && extracted.generalInstructions.length > 0) {
      console.log(`   📋 General Instructions (${extracted.generalInstructions.length}):`);
      extracted.generalInstructions.forEach((inst, i) => console.log(`      ${i + 1}. ${inst}`));
    }

    // ------------------------------------------------------------------
    // STEP 4: Extract Handwritten Answers & Spatial Regions from Sheet
    // ------------------------------------------------------------------
    console.log(`⏳ [pipeline] [4/6] Extracting handwritten answers & bounding boxes from sheet...`);
    const extractedAnswers: ExtractAnswersResult = await extractHandwrittenAnswers(pages);

    console.log(`✅ [pipeline] [4/6] Transcribed ${extractedAnswers.answers.length} handwritten answer section(s).`);
    extractedAnswers.answers.forEach((ans, idx) => {
      console.log(`   ✍️ [Answer #${idx + 1}] ID: "${ans.id || `ans_${idx + 1}`}" | Label: "${ans.label || 'N/A'}" | Page: ${ans.page} | Box: [${ans.box_2d.join(', ')}] | Text: "${ans.transcription.slice(0, 60).replace(/\n/g, ' ')}..."`);
    });

    // ------------------------------------------------------------------
    // STEP 5: Agent Thinking & Grounding Loop
    // ------------------------------------------------------------------
    let grounding: GroundingBrief | undefined;
    const skipThinking =
      process.env.SKIP_THINKING_LOOP === "1" ||
      process.env.SKIP_THINKING_LOOP === "true";

    if (!skipThinking) {
      console.log(`⏳ [pipeline] [5/6] Running agent thinking & research synthesis...`);
      setSessionStage(sessionId, "thinking_loop");
      try {
        grounding = await runGroundedThinkingLoop({ extracted });
        console.log(`✅ [pipeline] [5/6] Grounding synthesized:`, {
          subjectGuess: grounding.subjectGuess,
          usedGoogleSearch: grounding.usedGoogleSearch,
        });
      } catch (thinkErr) {
        console.warn(
          "⚠️ [pipeline] [5/6] Thinking loop failed; continuing without grounding:",
          thinkErr instanceof Error ? thinkErr.message : thinkErr,
        );
      }
    } else {
      console.log(`⏩ [pipeline] [5/6] Thinking loop skipped (SKIP_THINKING_LOOP=true).`);
    }

    // ------------------------------------------------------------------
    // STEP 6: Match Answers to Questions & Grade
    // ------------------------------------------------------------------
    console.log(`⏳ [pipeline] [6/6] Matching answers to questions & grading via Gemini AI...`);
    setSessionStage(sessionId, "map_answers");
    const mapped = await mapAnswersAndGrade(
      extracted.questions,
      extractedAnswers.answers,
      grounding ? formatGroundingForPrompt(grounding) : undefined,
    );

    console.log(`✅ [pipeline] [6/6] Answer matching & grading complete.`);
    console.log(`   📊 Total Answers Mapped: ${mapped.answers.length} | Unmapped Regions: ${mapped.unmappedAnswers?.length || 0}`);

    // ------------------------------------------------------------------
    // Finalize Evaluation Session & Accurate Spatial Highlights
    // ------------------------------------------------------------------
    setSessionStage(sessionId, "grade_feedback");
    const evaluation = buildEvaluationSession({
      sessionId,
      extracted,
      extractedAnswers,
      mapped,
      totalPages: pages.length,
      overallFeedback: mapped.overallFeedback,
      grounding,
    });

    setEvaluation(sessionId, evaluation);

    const tokenTotals = PipelineTokenTracker.getTotals();

    console.log(`\n======================================================`);
    console.log(`🎉 [pipeline] Evaluation Complete for Session: ${sessionId}`);
    console.log(`📈 Total Score: ${evaluation.totalMarks}/${evaluation.maxMarks} (${evaluation.percentage}%) | Grade: ${evaluation.gradeBadge}`);
    console.log(`🪙 Pipeline Token Usage (${tokenTotals.count} Gemini API calls):`);
    console.log(`   * Tokens IN  (Prompt)     : ${tokenTotals.totalIn.toLocaleString()} tokens`);
    console.log(`   * Tokens OUT (Candidates) : ${tokenTotals.totalOut.toLocaleString()} tokens`);
    console.log(`   * Total Session Tokens    : ${tokenTotals.grandTotal.toLocaleString()} tokens`);
    console.log(`======================================================\n`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown pipeline error";
    console.error(`❌ [pipeline] Fatal error in session ${sessionId}:`, message);
    setSessionFailure(sessionId, {
      title: "Evaluation failed",
      summary: message,
      issues: [
        {
          file: "both",
          code: "other",
          message,
          suggestions: [
            "Retry with clearer scans",
            "Confirm GEMINI_API_KEY is valid if this is a model error",
          ],
        },
      ],
      suggestions: ["Fix the issue above, then re-upload both files."],
    });
  }
}

function documentsAreUsable(v: ValidateDocumentsResult): boolean {
  if (!v.questionPaper.isValidQuestionPaper) return false;
  if (!v.answerSheet.isValidAnswerSheet) return false;
  if (!v.pairLooksCompatible) return false;
  return true;
}

function toSessionFailure(v: ValidateDocumentsResult): SessionFailure {
  const issues =
    v.issues.length > 0
      ? v.issues
      : [
          !v.questionPaper.isValidQuestionPaper
            ? {
                file: "questionPaper" as const,
                code: "not_question_paper" as const,
                message: v.questionPaper.notes || "Not a usable question paper.",
                suggestions: [
                  "Upload the printed exam question paper (PDF or clear image)",
                ],
              }
            : null,
          !v.answerSheet.isValidAnswerSheet
            ? {
                file: "answerSheet" as const,
                code: "not_answer_sheet" as const,
                message: v.answerSheet.notes || "Not a usable answer sheet.",
                suggestions: [
                  "Upload one student's handwritten answer sheet scan",
                ],
              }
            : null,
          !v.pairLooksCompatible
            ? {
                file: "both" as const,
                code: "wrong_subject_or_mismatch" as const,
                message:
                  "The answer sheet does not appear to match this question paper.",
                suggestions: [
                  "Use the answer sheet written for this exact question paper",
                ],
              }
            : null,
        ].filter(Boolean);

  const suggestions =
    v.suggestions.length > 0
      ? v.suggestions
      : [
          "Re-upload a clear question paper PDF/image",
          "Re-upload the matching handwritten answer sheet",
        ];

  return {
    title: "We couldn’t map these documents",
    summary:
      issues.map((i) => i!.message).join(" ") ||
      "The uploaded files are not suitable for question–answer mapping.",
    issues: issues as SessionFailure["issues"],
    suggestions,
  };
}

function buildEvaluationSession(args: {
  sessionId: string;
  extracted: ExtractQuestionsResult;
  extractedAnswers: ExtractAnswersResult;
  mapped: Awaited<ReturnType<typeof mapAnswersAndGrade>>;
  totalPages: number;
  overallFeedback?: string | null;
  grounding?: GroundingBrief;
}): EvaluationSession {
  const { sessionId, extracted, extractedAnswers, mapped, totalPages, grounding } = args;

  // Build lookups for ground-truth extracted handwritten answers
  const answerById = new Map(
    extractedAnswers.answers.map((a) => [a.id, a]),
  );
  const answerByLabel = new Map(
    extractedAnswers.answers
      .filter((a) => Boolean(a.label))
      .map((a) => [normalizeNumber(a.label!), a]),
  );

  const byNumber = new Map(
    mapped.answers.map((a) => [normalizeNumber(a.questionNumber), a]),
  );

  const questions: MappedQuestion[] = extracted.questions.map((q, index) => {
    const hit = byNumber.get(normalizeNumber(q.number));
    const maxMarks = Math.max(0.25, hit?.maxMarks || q.maxMarks || 1);
    const status = hit?.status ?? "unanswered";
    const marksObtained =
      status === "unanswered" || status === "optional_skipped"
        ? 0
        : Math.min(maxMarks, hit?.marksObtained ?? 0);
    const transcription = hit?.studentAnswer ?? "";

    // Determine accurate bounding box:
    let regions: AnswerRegion[] = [];

    // 1. If matchedAnswerId exists in extractedAnswers, use that ground-truth detected box
    if (hit?.matchedAnswerId && answerById.has(hit.matchedAnswerId)) {
      const matched = answerById.get(hit.matchedAnswerId)!;
      regions = [toRegion({ page: matched.page, box_2d: matched.box_2d })];
    }

    // 2. Or check if hit.regions contains real non-dummy boxes
    if (regions.length === 0 && Array.isArray(hit?.regions) && hit.regions.length > 0) {
      const valid = hit.regions
        .filter((r) => r && Array.isArray(r.box_2d) && (r.box_2d[0] !== 50 || r.box_2d[1] !== 50 || r.box_2d[2] !== 200))
        .map(toRegion);
      if (valid.length > 0) regions = valid;
    }

    // 3. Match by question label in extractedAnswers (e.g. "Q.1", "Q.17", "Q.24(i)", "Q.33(ii)")
    if (
      regions.length === 0 &&
      status !== "unanswered" &&
      status !== "optional_skipped"
    ) {
      const normQ = normalizeNumber(q.number);
      const normSub = q.subNumber ? normalizeNumber(q.subNumber) : null;
      const matched =
        answerByLabel.get(normQ) ||
        (normSub ? answerByLabel.get(normSub) : undefined) ||
        answerByLabel.get(`ans${normQ}`) ||
        answerByLabel.get(`q${normQ}`) ||
        (normSub ? answerByLabel.get(`q${normSub}`) : undefined);
      if (matched) {
        regions = [toRegion({ page: matched.page, box_2d: matched.box_2d })];
      }
    }

    const first = regions[0];

    return {
      id: `q${index + 1}`,
      number: q.number,
      questionNumber: index + 1,
      title: q.title || `Question ${q.number}`,
      questionText: q.questionText,
      maxMarks,
      marksObtained,
      status,
      studentAnswer: transcription,
      studentAnswerTranscription: transcription,
      modelAnswer: hit?.modelAnswer ?? "",
      aiRemarks:
        hit?.aiRemarks ||
        (status === "optional_skipped"
          ? "Alternative choice attempted."
          : status === "unanswered"
            ? "No answer found on the sheet."
            : ""),
      confidence: hit?.confidence ?? (status === "unanswered" ? 0 : 85),
      rubric: [],
      regions,
      page: first?.page ?? 1,
      boundingBox: first?.box ?? emptyBox(),
      section: q.section,
      parentQuestionNumber: q.parentQuestionNumber,
      subPart: q.subPart,
      subNumber: q.subNumber,
      isOptional: q.isOptional,
      choiceGroup: q.choiceGroup,
    };
  });

  const unmappedAnswers: UnmappedAnswer[] = (mapped.unmappedAnswers ?? []).map(
    (u, i) => ({
      id: `unmapped-${i + 1}`,
      transcription: u.transcription,
      regions: u.regions.map(toRegion),
    }),
  );

  const totalMarks = questions.reduce((s, q) => s + q.marksObtained, 0);

  // Derive maximum marks from printed paper header (e.g. 80, 100, 150),
  // or by summing compulsory questions + 1 choice per choiceGroup.
  let maxMarks = extracted.totalPaperMarks;
  if (!maxMarks || maxMarks <= 0) {
    const choiceGroupsSeen = new Set<string>();
    maxMarks = questions.reduce((s, q) => {
      if (q.isOptional && q.choiceGroup) {
        if (choiceGroupsSeen.has(q.choiceGroup)) return s;
        choiceGroupsSeen.add(q.choiceGroup);
        return s + q.maxMarks;
      }
      return s + (q.isOptional ? 0 : q.maxMarks);
    }, 0);
  }
  maxMarks = Math.max(1, maxMarks);
  const percentage = Number(((totalMarks / maxMarks) * 100).toFixed(1));

  return {
    id: sessionId,
    title: extracted.title || "AI Assessment Evaluation",
    subject: extracted.subject || "General",
    grade: extracted.grade || "",
    studentName: mapped.studentName || "Student",
    rollNumber: mapped.rollNumber || "",
    date: new Date().toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
    totalMarks,
    maxMarks,
    percentage,
    gradeBadge: gradeBadge(percentage),
    totalPages,
    questions,
    unmappedAnswers,
    grounding,
    totalPaperMarks: extracted.totalPaperMarks ?? maxMarks,
    duration: extracted.duration,
    sections: extracted.sections,
    generalInstructions: extracted.generalInstructions,
  };
}

function toRegion(r: {
  page: number;
  box_2d: number[];
}): AnswerRegion {
  return {
    page: r.page,
    box: box2dToPct(r.box_2d),
  };
}

function normalizeNumber(n: string) {
  return n.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function gradeBadge(pct: number) {
  if (pct >= 90) return "A+ (Outstanding)";
  if (pct >= 80) return "A (Distinction)";
  if (pct >= 70) return "B+ (First Class)";
  if (pct >= 60) return "B (Second Class)";
  if (pct >= 40) return "C (Pass)";
  return "D (Needs Improvement)";
}
