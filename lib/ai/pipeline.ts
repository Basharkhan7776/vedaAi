import { extractQuestions, mapAnswersAndGrade } from "@/lib/ai/gemini";
import { box2dToPct, emptyBox } from "@/lib/geometry/box";
import { rasterizeAnswerSheet } from "@/lib/pdf/rasterize";
import {
  setAnswerPages,
  setEvaluation,
  setSessionStage,
  getSession,
} from "@/lib/session/store";
import type {
  AnswerRegion,
  EvaluationSession,
  MappedQuestion,
  UnmappedAnswer,
} from "@/lib/types/evaluation";
import type { ExtractQuestionsResult } from "@/lib/ai/schemas";

export async function runEvaluationPipeline(sessionId: string): Promise<void> {
  const session = getSession(sessionId);
  if (!session?.questionPaper || !session.answerSheet) {
    setSessionStage(sessionId, "error", "Missing uploaded files");
    return;
  }

  try {
    setSessionStage(sessionId, "ingest_rasterize");
    const pages = await rasterizeAnswerSheet(session.answerSheet);
    setAnswerPages(sessionId, pages);

    setSessionStage(sessionId, "extract_questions");
    const extracted = await extractQuestions(session.questionPaper);

    setSessionStage(sessionId, "map_answers");
    const mapped = await mapAnswersAndGrade(pages, extracted.questions);

    setSessionStage(sessionId, "grade_feedback");
    const evaluation = buildEvaluationSession({
      sessionId,
      extracted,
      mapped,
      totalPages: pages.length,
      overallFeedback: mapped.overallFeedback,
    });

    setEvaluation(sessionId, evaluation);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown pipeline error";
    console.error("[pipeline]", sessionId, message);
    setSessionStage(sessionId, "error", message);
  }
}

function buildEvaluationSession(args: {
  sessionId: string;
  extracted: ExtractQuestionsResult;
  mapped: Awaited<ReturnType<typeof mapAnswersAndGrade>>;
  totalPages: number;
  overallFeedback?: string;
}): EvaluationSession {
  const { sessionId, extracted, mapped, totalPages } = args;
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

  const totalMarks = questions.reduce((s, q) => s + q.marksObtained, 0);
  const maxMarks = questions.reduce((s, q) => s + q.maxMarks, 0) || 1;
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
