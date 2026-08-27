import {
  extractQuestions,
  mapAnswersAndGrade,
  validateDocuments,
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
  ExtractQuestionsResult,
  ValidateDocumentsResult,
} from "@/lib/ai/schemas";

export async function runEvaluationPipeline(sessionId: string): Promise<void> {
  const session = getSession(sessionId);
  if (!session?.questionPaper || !session.answerSheet) {
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

  try {
    setSessionStage(sessionId, "ingest_rasterize");
    let pages;
    try {
      pages = await rasterizeAnswerSheet(session.answerSheet);
      setAnswerPages(sessionId, pages);
    } catch (rasterErr) {
      const message =
        rasterErr instanceof Error
          ? rasterErr.message
          : "Could not read answer sheet pages";
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

    setSessionStage(sessionId, "validate_documents");
    const validation = await validateDocuments({
      questionPaper: session.questionPaper,
      answerSheet: session.answerSheet,
      answerPreviewPage: pages[0],
    });

    if (!documentsAreUsable(validation)) {
      setSessionFailure(sessionId, toSessionFailure(validation));
      return;
    }

    setSessionStage(sessionId, "extract_questions");
    const extracted = await extractQuestions(session.questionPaper);

    setSessionStage(sessionId, "thinking_loop");
    let grounding: GroundingBrief | undefined;
    try {
      grounding = await runGroundedThinkingLoop({ extracted });
    } catch (thinkErr) {
      console.warn(
        "[pipeline] thinking loop failed; continuing without grounding",
        thinkErr,
      );
    }

    setSessionStage(sessionId, "map_answers");
    const mapped = await mapAnswersAndGrade(
      pages,
      extracted.questions,
      grounding ? formatGroundingForPrompt(grounding) : undefined,
    );

    setSessionStage(sessionId, "grade_feedback");
    const evaluation = buildEvaluationSession({
      sessionId,
      extracted,
      mapped,
      totalPages: pages.length,
      overallFeedback: mapped.overallFeedback,
      grounding,
    });

    setEvaluation(sessionId, evaluation);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown pipeline error";
    console.error("[pipeline]", sessionId, message);
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
  mapped: Awaited<ReturnType<typeof mapAnswersAndGrade>>;
  totalPages: number;
  overallFeedback?: string;
  grounding?: GroundingBrief;
}): EvaluationSession {
  const { sessionId, extracted, mapped, totalPages, grounding } = args;
  const byNumber = new Map(
    mapped.answers.map((a) => [normalizeNumber(a.questionNumber), a]),
  );

  const questions: MappedQuestion[] = extracted.questions.map((q, index) => {
    const hit = byNumber.get(normalizeNumber(q.number));
    const maxMarks = hit?.maxMarks || q.maxMarks || 0;
    const regions = (hit?.regions ?? []).map(toRegion);
    const first = regions[0];
    const status = hit?.status ?? "unanswered";
    const marksObtained =
      status === "unanswered" ? 0 : (hit?.marksObtained ?? 0);
    const transcription = hit?.studentAnswer ?? "";

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
        (status === "unanswered" ? "No answer found on the sheet." : ""),
      confidence: hit?.confidence ?? (status === "unanswered" ? 0 : 80),
      rubric: [],
      regions,
      page: first?.page ?? 1,
      boundingBox: first?.box ?? emptyBox(),
    };
  });

  const unmappedAnswers: UnmappedAnswer[] = (mapped.unmappedAnswers ?? []).map(
    (u, i) => ({
      id: `unmapped-${i + 1}`,
      transcription: u.transcription,
      regions: u.regions.map(toRegion),
    }),
  );

  // If Gemini omitted box_2d (common on plain text PDFs), synthesize stacked
  // regions so the answer-sheet UI can still highlight mapped answers.
  const withBoxes = applyFallbackRegions(questions);

  const totalMarks = withBoxes.reduce((s, q) => s + q.marksObtained, 0);
  const maxMarks = withBoxes.reduce((s, q) => s + q.maxMarks, 0) || 1;
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
    questions: withBoxes,
    unmappedAnswers,
    grounding,
  };
}

function applyFallbackRegions(questions: MappedQuestion[]): MappedQuestion[] {
  const needing = questions.filter(
    (q) =>
      q.status !== "unanswered" &&
      (q.regions.length === 0 ||
        (!q.boundingBox.width && !q.boundingBox.height)),
  );
  if (needing.length === 0) return questions;

  const slot = Math.max(10, Math.floor(80 / needing.length));
  let cursor = 8;

  return questions.map((q) => {
    if (
      q.status === "unanswered" ||
      (q.regions.length > 0 && (q.boundingBox.width || q.boundingBox.height))
    ) {
      return q;
    }
    const box = {
      x: 6,
      y: cursor,
      width: 88,
      height: Math.min(slot - 1, 18),
    };
    cursor += slot;
    return {
      ...q,
      page: q.page || 1,
      boundingBox: box,
      regions: [{ page: q.page || 1, box }],
    };
  });
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
  return n.replace(/\s+/g, "").toLowerCase();
}

function gradeBadge(pct: number) {
  if (pct >= 90) return "A+ (Outstanding)";
  if (pct >= 80) return "A (Distinction)";
  if (pct >= 70) return "B+ (First Class)";
  if (pct >= 60) return "B (Second Class)";
  if (pct >= 40) return "C (Pass)";
  return "D (Needs Improvement)";
}
