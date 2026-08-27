import { NextResponse } from "next/server";
import { hasGeminiKey } from "@/lib/ai/gemini";
import { runEvaluationPipeline } from "@/lib/ai/pipeline";
import {
  createSession,
  setSessionFiles,
  setEvaluation,
  setSessionFailure,
  setSessionStage,
} from "@/lib/session/store";
import type { StoredFile } from "@/lib/types/evaluation";
import { SAMPLE_EVALUATION } from "@/components/page/mock-data";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const questionPaper = form.get("questionPaper");
    const answerSheet = form.get("answerSheet");
    const demo = form.get("demo") === "true" || form.get("demo") === "1";
    const forceFail =
      form.get("forceFail") === "true" || form.get("forceFail") === "1";

    if (!(questionPaper instanceof File) || !(answerSheet instanceof File)) {
      return NextResponse.json(
        { error: "Both questionPaper and answerSheet files are required." },
        { status: 400 },
      );
    }

    const session = createSession();

    if (demo || !hasGeminiKey()) {
      setSessionStage(session.id, "ingest_rasterize");
      void runDemoPipeline(session.id, { forceFail });
      return NextResponse.json({
        sessionId: session.id,
        demo: true,
        forceFail,
        message: forceFail
          ? "Demo failed-document state"
          : hasGeminiKey()
            ? "Demo mode requested"
            : "GEMINI_API_KEY missing — using demo evaluation",
      });
    }

    const qp = await toStoredFile(questionPaper);
    const ans = await toStoredFile(answerSheet);
    setSessionFiles(session.id, qp, ans);

    void runEvaluationPipeline(session.id);

    return NextResponse.json({ sessionId: session.id, demo: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    console.error("[evaluate]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function toStoredFile(file: File): Promise<StoredFile> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return {
    name: file.name,
    mimeType: file.type || guessMime(file.name),
    bytes: buffer,
  };
}

function guessMime(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

async function runDemoPipeline(
  sessionId: string,
  opts: { forceFail?: boolean } = {},
) {
  const stages = [
    "ingest_rasterize",
    "validate_documents",
    "extract_questions",
    "thinking_loop",
    "map_answers",
    "grade_feedback",
  ] as const;

  for (const stage of stages) {
    setSessionStage(sessionId, stage);
    await sleep(500);
    if (opts.forceFail && stage === "validate_documents") {
      setSessionFailure(sessionId, {
        title: "We couldn’t map these documents",
        summary:
          "The file uploaded as the question paper does not look like an exam paper, and the answer sheet appears unrelated.",
        issues: [
          {
            file: "questionPaper",
            code: "not_question_paper",
            message:
              "This PDF looks like a generic document (not a numbered exam question paper).",
            suggestions: [
              "Upload the printed exam question paper (PDF or clear photo)",
              "Ensure questions and marks are visible",
            ],
          },
          {
            file: "answerSheet",
            code: "wrong_subject_or_mismatch",
            message:
              "The answer sheet content does not appear to match the uploaded question paper.",
            suggestions: [
              "Upload the handwritten answer sheet written for this exact paper",
              "Use a clear, upright scan (avoid blank or blurred pages)",
            ],
          },
        ],
        suggestions: [
          "Return to Upload",
          "Attach a real question paper + matching student answer sheet",
          "Run Start Mapping again",
        ],
      });
      return;
    }
  }

  setEvaluation(sessionId, {
    ...SAMPLE_EVALUATION,
    id: sessionId,
    questions: SAMPLE_EVALUATION.questions.map((q) => ({
      ...q,
      number: q.number ?? String(q.questionNumber),
      studentAnswer: q.studentAnswerTranscription,
      regions: q.regions ?? [
        { page: q.page, box: q.boundingBox },
      ],
    })),
    unmappedAnswers: [],
  } as import("@/lib/types/evaluation").EvaluationSession);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
