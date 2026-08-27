import fs from "fs";
import path from "path";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import type { StoredFile, StoredPage } from "@/lib/types/evaluation";

const execAsync = promisify(exec);

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
    return rasterizePdf(file.bytes, file.name);
  }

  throw new Error(
    `Unsupported answer sheet type: ${file.mimeType || file.name}. Use PDF or images.`,
  );
}

async function rasterizePdf(bytes: Buffer, fileName = "answer.pdf"): Promise<StoredPage[]> {
  // Strategy 1: High-speed native poppler `pdftoppm`
  try {
    const pages = await rasterizeWithPdftoppm(bytes);
    if (pages.length > 0) return pages;
  } catch (popplerErr) {
    console.warn(
      "[rasterize] pdftoppm failed or not installed, falling back to pdf-to-img:",
      popplerErr instanceof Error ? popplerErr.message : popplerErr,
    );
  }

  // Strategy 2: Node pdf-to-img library
  try {
    const { pdf } = await import("pdf-to-img");
    const document = await pdf(bytes, { scale: 1.5 });
    const pages: StoredPage[] = [];
    let pageNum = 1;

    for await (const image of document) {
      pages.push({
        page: pageNum,
        mimeType: "image/png",
        bytes: Buffer.from(image),
      });
      pageNum += 1;
    }

    if (pages.length > 0) return pages;
  } catch (pdfToImgErr) {
    console.warn(
      "[rasterize] pdf-to-img failed:",
      pdfToImgErr instanceof Error ? pdfToImgErr.message : pdfToImgErr,
    );
  }

  // Strategy 3: Graceful fallback — pass PDF bytes directly
  return [
    {
      page: 1,
      mimeType: "application/pdf",
      bytes,
    },
  ];
}

async function rasterizeWithPdftoppm(bytes: Buffer): Promise<StoredPage[]> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "veda-pdf-"));
  const inputPdf = path.join(tempDir, "input.pdf");
  const outputPrefix = path.join(tempDir, "page");

  try {
    fs.writeFileSync(inputPdf, bytes);
    // Render at 150 DPI for optimal OCR balance and speed
    await execAsync(`pdftoppm -png -r 150 "${inputPdf}" "${outputPrefix}"`, {
      timeout: 30_000,
    });

    const files = fs
      .readdirSync(tempDir)
      .filter((f) => f.startsWith("page-") && f.endsWith(".png"))
      .sort((a, b) => {
        // Natural sort for page-1.png, page-2.png, page-10.png
        const numA = parseInt(a.replace(/[^0-9]/g, ""), 10) || 0;
        const numB = parseInt(b.replace(/[^0-9]/g, ""), 10) || 0;
        return numA - numB;
      });

    const pages: StoredPage[] = files.map((file, index) => {
      const pageBytes = fs.readFileSync(path.join(tempDir, file));
      return {
        page: index + 1,
        mimeType: "image/png",
        bytes: pageBytes,
      };
    });

    return pages;
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  }
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
