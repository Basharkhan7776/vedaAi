import { NextResponse } from "next/server";
import { getPage, getSession } from "@/lib/session/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; page: string }> },
) {
  const { id, page: pageStr } = await context.params;
  const pageNum = Number(pageStr);

  if (!Number.isFinite(pageNum) || pageNum < 1) {
    return NextResponse.json({ error: "Invalid page" }, { status: 400 });
  }

  const session = getSession(id);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const page = getPage(id, pageNum);
  if (page) {
    return new NextResponse(new Uint8Array(page.bytes), {
      status: 200,
      headers: {
        "Content-Type": page.mimeType,
        "Cache-Control": "private, max-age=300",
      },
    });
  }

  // Fallback from session.pageImages data URL if raw bytes not present
  const dataUrl = session.pageImages?.[pageNum - 1];
  if (dataUrl && dataUrl.startsWith("data:")) {
    const base64Data = dataUrl.split(",")[1];
    const mimeType = dataUrl.split(";")[0].replace("data:", "");
    const buffer = Buffer.from(base64Data, "base64");
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "private, max-age=300",
      },
    });
  }

  return NextResponse.json({ error: "Page not found" }, { status: 404 });
}
