import { NextResponse } from "next/server";
import { hasGeminiKey } from "@/lib/ai/gemini";
import { runEvaluationPipeline } from "@/lib/ai/pipeline";
import {
  createSession,
  setSessionFiles,
  setEvaluation,
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

    if (!(questionPaper instanceof File) || !(answerSheet instanceof File)) {
      return NextResponse.json(
        { error: "Both questionPaper and answerSheet files are required." },
        { status: 400 },
      );
    }

    const session = createSession();

    if (demo || !hasGeminiKey()) {
      setSessionStage(session.id, "ingest_rasterize");
      // Async-ish demo so the upload UI can poll stages
      void runDemoPipeline(session.id);
      return NextResponse.json({
        sessionId: session.id,
        demo: true,
        message: hasGeminiKey()
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

async function runDemoPipeline(sessionId: string) {
  const stages = [
    "ingest_rasterize",
    "extract_questions",
    "map_answers",
    "grade_feedback",
  ] as const;

  for (const stage of stages) {
    setSessionStage(sessionId, stage);
    await sleep(600);
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
