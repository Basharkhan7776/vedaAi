import fs from "fs";
import path from "path";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import type { StoredFile, StoredPage } from "@/lib/types/evaluation";

const execAsync = promisify(exec);

// Polyfill DOM globals required by pdfjs-dist in serverless Node environments (Vercel)
function ensureDomPolyfills() {
  const g = globalThis as unknown as Record<string, unknown>;

  // Attempt to load native canvas objects from @napi-rs/canvas
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const canvas = require("@napi-rs/canvas");
    if (!g.DOMMatrix && canvas.DOMMatrix) g.DOMMatrix = canvas.DOMMatrix;
    if (!g.DOMPoint && canvas.DOMPoint) g.DOMPoint = canvas.DOMPoint;
    if (!g.DOMRect && canvas.DOMRect) g.DOMRect = canvas.DOMRect;
    if (!g.ImageData && canvas.ImageData) g.ImageData = canvas.ImageData;
    if (!g.Path2D && canvas.Path2D) g.Path2D = canvas.Path2D;
  } catch {
    // @napi-rs/canvas optional fallback
  }

  if (typeof g.DOMMatrix === "undefined") {
    class DOMMatrixPolyfill {
      a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
      m11 = 1; m12 = 0; m13 = 0; m14 = 0;
      m21 = 0; m22 = 1; m23 = 0; m24 = 0;
      m31 = 0; m32 = 0; m33 = 1; m34 = 0;
      m41 = 0; m42 = 0; m43 = 0; m44 = 1;
      is2D = true;
      isIdentity = true;

      constructor(init?: number[] | string) {
        if (Array.isArray(init) && init.length >= 6) {
          this.a = this.m11 = init[0];
          this.b = this.m12 = init[1];
          this.c = this.m21 = init[2];
          this.d = this.m22 = init[3];
          this.e = this.m41 = init[4];
          this.f = this.m42 = init[5];
        }
      }
      multiply() { return this; }
      translate() { return this; }
      scale() { return this; }
      rotate() { return this; }
      inverse() { return this; }
      transformPoint(p: unknown) { return p; }
      toFloat32Array() {
        return new Float32Array([
          this.m11, this.m12, this.m13, this.m14,
          this.m21, this.m22, this.m23, this.m24,
          this.m31, this.m32, this.m33, this.m34,
          this.m41, this.m42, this.m43, this.m44,
        ]);
      }
      toFloat64Array() {
        return new Float64Array([
          this.m11, this.m12, this.m13, this.m14,
          this.m21, this.m22, this.m23, this.m24,
          this.m31, this.m32, this.m33, this.m34,
          this.m41, this.m42, this.m43, this.m44,
        ]);
      }
    }
    g.DOMMatrix = DOMMatrixPolyfill;
  }

  if (typeof g.DOMPoint === "undefined") {
    class DOMPointPolyfill {
      x: number; y: number; z: number; w: number;
      constructor(x = 0, y = 0, z = 0, w = 1) {
        this.x = x; this.y = y; this.z = z; this.w = w;
      }
    }
    g.DOMPoint = DOMPointPolyfill;
  }

  if (typeof g.DOMRect === "undefined") {
    class DOMRectPolyfill {
      x: number; y: number; width: number; height: number;
      top: number; right: number; bottom: number; left: number;
      constructor(x = 0, y = 0, w = 0, h = 0) {
        this.x = this.left = x;
        this.y = this.top = y;
        this.width = w;
        this.height = h;
        this.right = x + w;
        this.bottom = y + h;
      }
    }
    g.DOMRect = DOMRectPolyfill;
  }
}

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
  // Ensure DOM polyfills are active before importing pdf-to-img / pdfjs-dist
  ensureDomPolyfills();

  // Strategy 1: High-speed native poppler `pdftoppm` (if installed on host)
  try {
    const pages = await rasterizeWithPdftoppm(bytes);
    if (pages.length > 0) return pages;
  } catch (popplerErr) {
    // Normal in serverless environments without C++ poppler binaries
  }

  // Strategy 2: Node pdf-to-img library with DOMMatrix polyfill
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
