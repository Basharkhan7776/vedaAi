import { NextResponse } from "next/server";
import { getSession } from "@/lib/session/store";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const session = getSession(id);

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const { status } = session;

  if (!status.terminal) {
    return NextResponse.json(
      {
        ok: false,
        pending: true,
        status,
      },
      { status: 202 },
    );
  }

  if (session.evaluation && status.ready) {
    return NextResponse.json({
      ok: true,
      evaluation: session.evaluation,
      status,
      hasPageImages: session.answerPages.length > 0,
    });
  }

  // failed / error — always expose contextual failure when present
  return NextResponse.json({
    ok: false,
    failure: session.failure ?? {
      title: "Evaluation failed",
      summary: status.error || status.stageLabel || "Unknown failure",
      issues: [
        {
          file: "both" as const,
          code: "other" as const,
          message: status.error || status.stageLabel || "Unknown failure",
          suggestions: ["Return to Upload and try again with clearer files."],
        },
      ],
      suggestions: ["Re-upload both files from the Upload page."],
    },
    status,
    hasPageImages: session.answerPages.length > 0,
  });
}
