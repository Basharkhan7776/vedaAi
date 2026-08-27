import type { StoredFile, StoredPage } from "@/lib/types/evaluation";

const IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

/**
 * Turn an answer sheet (PDF or image(s)) into ordered page bitmaps for
 * Gemini box_2d detection and CSS overlay rendering.
 */
export async function rasterizeAnswerSheet(
  file: StoredFile,
): Promise<StoredPage[]> {
  if (IMAGE_TYPES.has(file.mimeType) || isImageName(file.name)) {
    return [
      {
        page: 1,
        mimeType: normalizeImageMime(file.mimeType, file.name),
        bytes: file.bytes,
      },
    ];
  }

  if (
    file.mimeType === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf")
  ) {
    return rasterizePdf(file.bytes);
  }

  throw new Error(
    `Unsupported answer sheet type: ${file.mimeType || file.name}. Use PDF or images.`,
  );
}

async function rasterizePdf(bytes: Buffer): Promise<StoredPage[]> {
  const { pdf } = await import("pdf-to-img");
  const document = await pdf(bytes, { scale: 2 });
  const pages: StoredPage[] = [];
  let page = 1;

  for await (const image of document) {
    pages.push({
      page,
      mimeType: "image/png",
      bytes: Buffer.from(image),
    });
    page += 1;
  }

  if (pages.length === 0) {
    throw new Error("PDF produced zero pages");
  }

  return pages;
}

function isImageName(name: string) {
  return /\.(png|jpe?g|webp|gif)$/i.test(name);
}

function normalizeImageMime(mime: string, name: string) {
  if (mime && mime !== "application/octet-stream") return mime;
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}
