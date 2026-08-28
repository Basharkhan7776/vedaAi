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
    // If session ID matches our standard pattern, return pending to allow cold-start container recovery
    if (/^session-[a-z0-9]+-[a-z0-9]+$/i.test(id)) {
      return NextResponse.json({
        id,
        stage: "queued",
        stageIndex: 0,
        stageLabel: "Processing evaluation…",
        progress: 15,
        ready: false,
        terminal: false,
      });
    }
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json(session.status);
}
