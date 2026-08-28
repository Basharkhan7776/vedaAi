import { NextResponse } from "next/server";
import { getSession } from "@/lib/session/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const session = getSession(id);

  if (!session) {
    return NextResponse.json(
      {
        ok: false,
        error: "Session not found",
        message: `Session "${id}" was not found or has expired. In-memory sessions reset when the server restarts.`,
        failure: {
          title: "Session Expired or Not Found",
          summary: `Session "${id}" could not be found. Sessions are stored in-memory and reset when the dev server restarts or reloads.`,
          issues: [
            {
              file: "both" as const,
              code: "other" as const,
              message: `Session "${id}" is no longer active in memory.`,
              suggestions: [
                "Return to the Upload page to start a new evaluation session.",
                "Re-upload your Question Paper and Answer Sheet files.",
              ],
            },
          ],
          suggestions: [
            "Click 'Re-upload' to choose your files again.",
            "If using sample files, click 'Load Sample Files' on the home page.",
          ],
        },
      },
      { status: 404 },
    );
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
      hasPageImages: (session.pageImages && session.pageImages.length > 0) || session.answerPages.length > 0,
      pageImages: session.pageImages,
    });
  }

  // Failed / error state
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
