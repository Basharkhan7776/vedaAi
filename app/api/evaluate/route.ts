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
import type { PipelineProgressEvent, StoredFile } from "@/lib/types/evaluation";
import { SAMPLE_EVALUATION } from "@/components/page/mock-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const questionPaper = form.get("questionPaper");
    const answerSheet = form.get("answerSheet");
    const demo = form.get("demo") === "true" || form.get("demo") === "1";
    const forceFail =
      form.get("forceFail") === "true" || form.get("forceFail") === "1";
    const wantsStream =
      form.get("stream") === "true" ||
      form.get("stream") === "1" ||
      request.headers.get("accept")?.includes("application/x-ndjson");

    if (!(questionPaper instanceof File) || !(answerSheet instanceof File)) {
      return NextResponse.json(
        { error: "Both questionPaper and answerSheet files are required." },
        { status: 400 },
      );
    }

    const session = createSession();
    const qp = await toStoredFile(questionPaper);
    const ans = await toStoredFile(answerSheet);
    setSessionFiles(session.id, qp, ans);

    const isDemoMode = demo || !hasGeminiKey();

    // If client requested active streaming (or modern web UI)
    if (wantsStream) {
      const encoder = new TextEncoder();
      const stream = new TransformStream();
      const writer = stream.writable.getWriter();

      const sendEvent = async (event: PipelineProgressEvent) => {
        try {
          await writer.write(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {
          // Client disconnected
        }
      };

      // Run pipeline synchronously inside active serverless execution context
      (async () => {
        try {
          if (isDemoMode) {
            await runDemoPipeline(session.id, { forceFail, onProgress: sendEvent });
          } else {
            await runEvaluationPipeline(session.id, sendEvent);
          }
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Evaluation failed unexpectedly";
          await sendEvent({
            type: "error",
            sessionId: session.id,
            stage: "error",
            progress: 0,
            error: message,
          });
        } finally {
          try {
            await writer.close();
          } catch {
            // Stream already closed
          }
        }
      })();

      return new Response(stream.readable, {
        headers: {
          "Content-Type": "application/x-ndjson; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          "Connection": "keep-alive",
          "X-Accel-Buffering": "no",
          "X-Session-Id": session.id,
        },
      });
    }

    // Fallback for non-streaming clients: trigger background and return sessionId
    if (isDemoMode) {
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
  opts: {
    forceFail?: boolean;
    onProgress?: (event: PipelineProgressEvent) => Promise<void>;
  } = {},
) {
  const stages = [
    { stage: "ingest_rasterize", progress: 15, label: "Ingesting & rendering answer sheet pages…" },
    { stage: "validate_documents", progress: 30, label: "Checking that uploaded files look like a QP and answer sheet…" },
    { stage: "extract_questions", progress: 45, label: "Extracting questions from the question paper…" },
    { stage: "thinking_loop", progress: 60, label: "Agent thinking + Google Search grounding…" },
    { stage: "map_answers", progress: 75, label: "Mapping handwritten answers to questions…" },
    { stage: "grade_feedback", progress: 90, label: "Scoring answers & generating AI feedback…" },
  ] as const;

  for (const item of stages) {
    setSessionStage(sessionId, item.stage);
    if (opts.onProgress) {
      await opts.onProgress({
        type: "stage",
        sessionId,
        stage: item.stage,
        progress: item.progress,
        stageLabel: item.label,
      });
    }
    await sleep(400);

    if (opts.forceFail && item.stage === "validate_documents") {
      const failure = {
        title: "We couldn’t map these documents",
        summary:
          "The file uploaded as the question paper does not look like an exam paper, and the answer sheet appears unrelated.",
        issues: [
          {
            file: "questionPaper" as const,
            code: "not_question_paper" as const,
            message:
              "This PDF looks like a generic document (not a numbered exam question paper).",
            suggestions: [
              "Upload the printed exam question paper (PDF or clear photo)",
              "Ensure questions and marks are visible",
            ],
          },
          {
            file: "answerSheet" as const,
            code: "wrong_subject_or_mismatch" as const,
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
      };
      setSessionFailure(sessionId, failure);
      if (opts.onProgress) {
        await opts.onProgress({
          type: "failure",
          sessionId,
          stage: "failed",
          progress: 100,
          stageLabel: failure.summary,
          failure,
        });
      }
      return;
    }
  }

  const evaluation = {
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
  } as import("@/lib/types/evaluation").EvaluationSession;

  setEvaluation(sessionId, evaluation);

  if (opts.onProgress) {
    await opts.onProgress({
      type: "complete",
      sessionId,
      stage: "complete",
      progress: 100,
      stageLabel: "Evaluation complete",
      evaluation,
    });
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
