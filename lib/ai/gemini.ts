import { GoogleGenAI } from "@google/genai";
import { jsonrepair } from "jsonrepair";
import type { StoredFile, StoredPage } from "@/lib/types/evaluation";
import {
  EXTRACT_PAGE_ANSWERS_PROMPT,
  EXTRACT_QUESTIONS_PROMPT,
  VALIDATE_DOCUMENTS_PROMPT,
  buildMapAndGradePrompt,
} from "@/lib/ai/prompts";
import {
  extractAnswersResultSchema,
  extractQuestionsResultSchema,
  mapAndGradeResultSchema,
  validateDocumentsResultSchema,
  type ExtractAnswersResult,
  type ExtractQuestionsResult,
  type MapAndGradeResult,
  type ValidateDocumentsResult,
} from "@/lib/ai/schemas";

let currentKeyIndex = 0;
let currentModelIndex = 0;

const MODEL_POOL = [
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-3.6-flash",
];

export const PipelineTokenTracker = {
  history: [] as Array<{
    stage: string;
    model: string;
    tokensIn: number;
    tokensOut: number;
    totalTokens: number;
  }>,

  record(
    stage: string,
    model: string,
    tokensIn: number,
    tokensOut: number,
    totalTokens: number,
  ) {
    this.history.push({ stage, model, tokensIn, tokensOut, totalTokens });
    console.log(
      `   🪙 [gemini] Tokens IN: ${tokensIn.toLocaleString()} | Tokens OUT: ${tokensOut.toLocaleString()} | Total: ${totalTokens.toLocaleString()} (${model})`,
    );
  },

  getTotals() {
    const totalIn = this.history.reduce((sum, h) => sum + h.tokensIn, 0);
    const totalOut = this.history.reduce((sum, h) => sum + h.tokensOut, 0);
    const grandTotal = this.history.reduce((sum, h) => sum + h.totalTokens, 0);
    return { totalIn, totalOut, grandTotal, count: this.history.length };
  },

  reset() {
    this.history = [];
  },
};

function getApiKeys(): string[] {
  const primary = process.env.GEMINI_API_KEY;
  const list = process.env.GEMINI_API_KEYS
    ? process.env.GEMINI_API_KEYS.split(",").map((k) => k.trim())
    : [];
  const keys = [primary, ...list].filter(Boolean) as string[];
  return Array.from(new Set(keys));
}

export function getClient() {
  const keys = getApiKeys();
  if (keys.length === 0) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to .env.local or use demo mode.",
    );
  }
  const key = keys[currentKeyIndex % keys.length];
  return new GoogleGenAI({ apiKey: key });
}

export function rotateKey() {
  const keys = getApiKeys();
  if (keys.length > 1) {
    currentKeyIndex = (currentKeyIndex + 1) % keys.length;
    console.log(`[gemini] Rotated to API Key #${currentKeyIndex + 1}/${keys.length}`);
  }
}

export function rotateModel() {
  currentModelIndex = (currentModelIndex + 1) % MODEL_POOL.length;
  console.log(`[gemini] Switched model to: ${MODEL_POOL[currentModelIndex]}`);
}

export function extractRetryDelayMs(err: any): number {
  try {
    const msg = String(err?.message || "");
    const match =
      msg.match(/retry in ([0-9.]+)s/i) ||
      msg.match(/retryDelay"?:\s*"([0-9]+)s"/i);
    if (match?.[1]) {
      const sec = parseFloat(match[1]);
      if (Number.isFinite(sec) && sec > 0) {
        return Math.min(Math.ceil(sec * 1000) + 1000, 30_000);
      }
    }
  } catch {
    // fallback
  }
  return 2000;
}

export function modelName() {
  const configured = process.env.GEMINI_MODEL;
  if (currentModelIndex === 0 && configured) {
    return configured;
  }
  return MODEL_POOL[currentModelIndex % MODEL_POOL.length];
}

function filePart(file: StoredFile) {
  return {
    inlineData: {
      mimeType: file.mimeType || "application/pdf",
      data: file.bytes.toString("base64"),
    },
  };
}

function pagePart(page: StoredPage) {
  return {
    inlineData: {
      mimeType: page.mimeType,
      data: page.bytes.toString("base64"),
    },
  };
}

type ContentPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

function extractJsonText(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return trimmed;

  const objStart = trimmed.indexOf("{");
  const arrStart = trimmed.indexOf("[");
  const start =
    objStart < 0
      ? arrStart
      : arrStart < 0
        ? objStart
        : Math.min(objStart, arrStart);
  if (start < 0) return trimmed;
  const opener = trimmed[start];
  const closer = opener === "[" ? "]" : "}";
  const end = trimmed.lastIndexOf(closer);
  if (end > start) return trimmed.slice(start, end + 1);
  return trimmed.slice(start);
}

function tryParseJson(raw: string): unknown {
  const cleaned = extractJsonText(raw);
  // 1. Native parse fast path
  try {
    return JSON.parse(cleaned);
  } catch {
    // 2. High-precision jsonrepair
    try {
      return JSON.parse(jsonrepair(cleaned));
    } catch {
      // 3. Progressive cleanup for cut-off / truncated streams
      let repaired = cleaned.trim();
      repaired = repaired.replace(/:\s*$/, ": null");
      repaired = repaired.replace(/,\s*$/, "");
      repaired = repaired.replace(/,\s*"[^"]*$/g, "");
      repaired = repaired.replace(/"[^"]*"\s*:\s*$/g, "");
      try {
        return JSON.parse(jsonrepair(repaired));
      } catch {
        // 4. Force closure of open brackets/braces
        const opens = (repaired.match(/\[/g) || []).length;
        const closes = (repaired.match(/\]/g) || []).length;
        const openB = (repaired.match(/\{/g) || []).length;
        const closeB = (repaired.match(/\}/g) || []).length;
        for (let i = 0; i < openB - closeB; i++) repaired += "}";
        for (let i = 0; i < opens - closes; i++) repaired += "]";
        return JSON.parse(jsonrepair(repaired));
      }
    }
  }
}

export function parseQuestionNumber(raw: string): {
  cleanNumber: string;
  parentNumber: string;
  subPart?: string;
  subNumber?: string;
} {
  let trimmed = String(raw || "").trim();
  trimmed = trimmed.replace(/^(?:Question|Q)\.?\s*/i, "").trim();

  // Pattern 1: Standalone integer like "1", "16", "23", "100"
  const intMatch = trimmed.match(/^(\d+)$/);
  if (intMatch) {
    return {
      cleanNumber: intMatch[1],
      parentNumber: intMatch[1],
    };
  }

  // Pattern 2: Parentheses subpart like "22(i)", "11(a)", "33(v)", "24(1)"
  const parenMatch = trimmed.match(/^(\d+)\s*\(([a-z0-9]+)\)$/i);
  if (parenMatch) {
    const parent = parenMatch[1];
    const part = parenMatch[2].toLowerCase();
    return {
      cleanNumber: `${parent}(${part})`,
      parentNumber: parent,
      subPart: part,
      subNumber: `${parent} ${part}.`,
    };
  }

  // Pattern 3: Dot or space followed by letter or roman numeral e.g. "11 a.", "11 a", "22.ii", "22 i"
  const letterMatch = trimmed.match(/^(\d+)\s*[\.\s]\s*([a-z]|[ivxlcdm]+)\.?$/i);
  if (letterMatch) {
    const parent = letterMatch[1];
    const part = letterMatch[2].toLowerCase();
    return {
      cleanNumber: `${parent}(${part})`,
      parentNumber: parent,
      subPart: part,
      subNumber: `${parent} ${part}.`,
    };
  }

  // Pattern 4: Dot followed by sub-digit e.g. "22.1"
  const dotNumMatch = trimmed.match(/^(\d+)\.(\d+)$/);
  if (dotNumMatch) {
    const parent = dotNumMatch[1];
    const part = dotNumMatch[2];
    return {
      cleanNumber: `${parent}(${part})`,
      parentNumber: parent,
      subPart: part,
      subNumber: `${parent} ${part}.`,
    };
  }

  // Pattern 5: Number directly followed by letter e.g. "11a", "22b"
  const directLetterMatch = trimmed.match(/^(\d+)([a-z])$/i);
  if (directLetterMatch) {
    const parent = directLetterMatch[1];
    const part = directLetterMatch[2].toLowerCase();
    return {
      cleanNumber: `${parent}(${part})`,
      parentNumber: parent,
      subPart: part,
      subNumber: `${parent} ${part}.`,
    };
  }

  return {
    cleanNumber: trimmed,
    parentNumber: trimmed,
  };
}

/** Normalize Gemini JSON output before Zod validation. */
function normalizeModelJson(
  parsed: unknown,
  kind: "validate" | "extract" | "answers" | "map",
): unknown {
  if (kind === "extract") {
    if (Array.isArray(parsed)) {
      return { questions: parsed.map(normalizeExtractedQuestion) };
    }
    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      const list = obj.questions ?? obj.items ?? obj.data;
      const parsedTotal = Number(obj.totalPaperMarks ?? obj.maxMarks ?? obj.totalMarks);
      const sections = Array.isArray(obj.sections) ? obj.sections.map(normalizeSectionInfo) : [];
      const instructions = Array.isArray(obj.generalInstructions)
        ? obj.generalInstructions.map(String)
        : Array.isArray(obj.instructions)
          ? obj.instructions.map(String)
          : [];

      return {
        ...obj,
        title: obj.title ? String(obj.title) : undefined,
        subject: obj.subject ? String(obj.subject) : undefined,
        grade: obj.grade ? String(obj.grade) : undefined,
        totalPaperMarks: Number.isFinite(parsedTotal) && parsedTotal > 0 ? parsedTotal : undefined,
        duration: obj.duration ? String(obj.duration) : undefined,
        generalInstructions: instructions,
        sections,
        questions: Array.isArray(list) ? list.map(normalizeExtractedQuestion) : [],
      };
    }
  }

  if (kind === "answers") {
    if (Array.isArray(parsed)) {
      return { answers: parsed.map((a, i) => normalizeExtractedAnswerItem(a, i)) };
    }
    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      const list = obj.answers ?? obj.items ?? obj.data;
      return {
        ...obj,
        studentName: obj.studentName ? String(obj.studentName) : undefined,
        rollNumber: obj.rollNumber ? String(obj.rollNumber) : undefined,
        answers: Array.isArray(list) ? list.map((a, i) => normalizeExtractedAnswerItem(a, i)) : [],
      };
    }
  }

  if (kind === "map" && parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    const answers = Array.isArray(obj.answers) ? obj.answers : [];
    const unmapped = Array.isArray(obj.unmappedAnswers)
      ? obj.unmappedAnswers
      : Array.isArray(obj.unmapped)
        ? obj.unmapped
        : [];
    const normalizedUnmapped = unmapped
      .map(normalizeUnmappedAnswer)
      .filter((u): u is { transcription: string; regions: unknown[] } => {
        if (!u || typeof u !== "object") return false;
        const regions = (u as { regions?: unknown[] }).regions;
        return Boolean(
          (Array.isArray(regions) && regions.length > 0) ||
            (u as { transcription?: string }).transcription,
        );
      })
      .filter((u) => Array.isArray(u.regions) && u.regions.length > 0);

    return {
      ...obj,
      studentName: obj.studentName ? String(obj.studentName) : undefined,
      rollNumber: obj.rollNumber ? String(obj.rollNumber) : undefined,
      overallFeedback: obj.overallFeedback ? String(obj.overallFeedback) : undefined,
      answers: answers.map(normalizeMappedAnswer),
      unmappedAnswers: normalizedUnmapped,
    };
  }

  return parsed;
}

function normalizeSectionInfo(s: unknown) {
  if (!s || typeof s !== "object") return { name: "Section" };
  const o = s as Record<string, unknown>;
  return {
    name: String(o.name ?? o.section ?? "Section"),
    title: o.title ? String(o.title) : undefined,
    questionRange: o.questionRange ? String(o.questionRange) : undefined,
    marksPerQuestion: Number(o.marksPerQuestion ?? o.marks) || undefined,
    totalMarks: Number(o.totalMarks ?? o.maxMarks) || undefined,
    isCompulsory: o.isCompulsory !== false,
    instructions: o.instructions ? String(o.instructions) : undefined,
  };
}

function normalizeExtractedQuestion(q: unknown) {
  if (!q || typeof q !== "object") return q;
  const o = q as Record<string, unknown>;
  const rawNum = String(o.number ?? o.label ?? o.id ?? "1").trim();
  const parsedNumInfo = parseQuestionNumber(rawNum);
  const parsedMarks = Number(o.maxMarks ?? o.max_marks ?? o.marks ?? 1) || 1;
  return {
    number: parsedNumInfo.cleanNumber,
    title: o.title ? String(o.title) : undefined,
    questionText: String(
      o.questionText ?? o.text ?? o.question ?? o.prompt ?? "",
    ),
    maxMarks: Math.max(0.25, parsedMarks),
    section: o.section ? String(o.section) : undefined,
    parentQuestionNumber: o.parentQuestionNumber ? String(o.parentQuestionNumber) : parsedNumInfo.parentNumber,
    subPart: parsedNumInfo.subPart,
    subNumber: parsedNumInfo.subNumber,
    isOptional: Boolean(o.isOptional),
    choiceGroup: o.choiceGroup ? String(o.choiceGroup) : undefined,
  };
}

function normalizeExtractedAnswerItem(a: unknown, idx = 0) {
  if (!a || typeof a !== "object") return a;
  const o = a as Record<string, unknown>;
  const region = normalizeRegion(o);
  const rawLabel = o.label ? String(o.label).trim() : undefined;
  const rawId = o.id ? String(o.id).trim() : `ans_${idx + 1}`;
  return {
    id: rawId,
    label: rawLabel,
    transcription: String(
      o.transcription ?? o.studentAnswer ?? o.text ?? o.answer ?? "",
    ),
    page: Number(o.page ?? region?.page ?? 1) || 1,
    box_2d: region?.box_2d ?? [50, 50, 200, 950],
  };
}

function normalizeMappedAnswer(a: unknown) {
  if (!a || typeof a !== "object") return a;
  const o = a as Record<string, unknown>;
  const rawNum = String(
    o.questionNumber ?? o.number ?? o.question_id ?? o.id ?? "",
  ).trim();
  const parsedNumInfo = parseQuestionNumber(rawNum);
  const regions = Array.isArray(o.regions)
    ? o.regions.map(normalizeRegion).filter(isValidRegion)
    : [];
  const maxMarks = Math.max(0.25, Number(o.maxMarks ?? o.max_marks ?? o.maxScore ?? 1) || 1);
  const marksObtained = Math.min(
    maxMarks,
    Math.max(0, Number(o.marksObtained ?? o.score ?? o.marks ?? o.awarded ?? 0) || 0)
  );

  return {
    questionNumber: parsedNumInfo.cleanNumber,
    matchedAnswerId: o.matchedAnswerId ? String(o.matchedAnswerId) : undefined,
    studentAnswer: String(
      o.studentAnswer ??
        o.studentAnswerText ??
        o.student_answer_text ??
        o.transcription ??
        o.answer ??
        o.text ??
        o.student_answer ??
        "",
    ),
    regions,
    status: normalizeStatus(o.status),
    marksObtained,
    maxMarks,
    aiRemarks: String(
      o.aiRemarks ?? o.feedback ?? o.remarks ?? o.reason ?? "",
    ),
    modelAnswer:
      o.modelAnswer != null && o.modelAnswer !== "" ? String(o.modelAnswer) : undefined,
    confidence:
      o.confidence != null ? Number(o.confidence) : undefined,
    isOptional: Boolean(o.isOptional),
    choiceGroup: o.choiceGroup ? String(o.choiceGroup) : undefined,
  };
}

function normalizeUnmappedAnswer(a: unknown) {
  if (!a || typeof a !== "object") return a;
  const o = a as Record<string, unknown>;
  return {
    transcription: String(
      o.transcription ??
        o.studentAnswer ??
        o.studentAnswerText ??
        o.text ??
        o.answer ??
        "",
    ),
    regions: Array.isArray(o.regions)
      ? o.regions.map(normalizeRegion).filter(isValidRegion)
      : [],
  };
}

function normalizeRegion(r: unknown) {
  if (!r || typeof r !== "object") return null;
  const o = r as Record<string, unknown>;
  let box = o.box_2d ?? o.box2d ?? o.bbox ?? o.box;

  // Handle nested array e.g. [[ymin, xmin, ymax, xmax]]
  if (Array.isArray(box) && box.length > 0 && Array.isArray(box[0])) {
    box = box[0];
  }

  if (!Array.isArray(box) || box.length < 4) return null;
  const nums = box.slice(0, 4).map(Number);
  if (nums.some((n) => !Number.isFinite(n))) return null;
  return {
    page: Number(o.page ?? 1) || 1,
    box_2d: nums,
  };
}

function isValidRegion(
  r: unknown,
): r is { page: number; box_2d: number[] } {
  return Boolean(
    r &&
      typeof r === "object" &&
      Array.isArray((r as { box_2d?: unknown }).box_2d) &&
      ((r as { box_2d: number[] }).box_2d.length === 4),
  );
}

function normalizeStatus(status: unknown) {
  const s = String(status ?? "unanswered").toLowerCase().trim();
  if (
    s === "correct" ||
    s === "partial" ||
    s === "incorrect" ||
    s === "unanswered" ||
    s === "optional_skipped"
  ) {
    return s;
  }
  if (s.includes("skip") || s.includes("option") || s.includes("choice")) return "optional_skipped";
  if (s === "full" || s === "right") return "correct";
  if (s === "wrong") return "incorrect";
  if (s === "none" || s === "missing" || s === "blank") return "unanswered";
  return "partial";
}

async function generateJson<T>(
  parts: ContentPart[],
  schema: {
    parse: (data: unknown) => T;
    safeParse?: (data: unknown) =>
      | { success: true; data: T }
      | { success: false; error: { message: string } };
  },
  systemInstruction: string,
  kind: "validate" | "extract" | "answers" | "map" = "map",
  attempt = 1,
): Promise<T> {
  const maxTokens = 65536;
  const currentModel = modelName();

  try {
    const ai = getClient();
    const response = await ai.models.generateContent({
      model: currentModel,
      contents: [{ role: "user", parts }],
      config: {
        systemInstruction,
        temperature: 0.1,
        responseMimeType: "application/json",
        maxOutputTokens: maxTokens,
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("Gemini returned an empty response");
    }

    if (response.usageMetadata) {
      const inT = response.usageMetadata.promptTokenCount ?? 0;
      const outT = response.usageMetadata.candidatesTokenCount ?? 0;
      const totalT = response.usageMetadata.totalTokenCount ?? (inT + outT);
      PipelineTokenTracker.record(kind, currentModel, inT, outT, totalT);
    }

    let parsed: unknown;
    try {
      parsed = normalizeModelJson(tryParseJson(text), kind);
    } catch {
      throw new Error(`Gemini returned invalid JSON: ${text.slice(0, 500)}`);
    }

    const parseOnce = (value: unknown) => {
      if (typeof schema.safeParse === "function") {
        return schema.safeParse(value);
      }
      try {
        return { success: true as const, data: schema.parse(value) };
      } catch (e) {
        return {
          success: false as const,
          error: {
            message: e instanceof Error ? e.message : "parse failed",
          },
        };
      }
    };

    let result = parseOnce(parsed);
    if (!result.success && kind === "map" && parsed && typeof parsed === "object") {
      const obj = { ...(parsed as Record<string, unknown>) };
      obj.unmappedAnswers = [];
      result = parseOnce(normalizeModelJson(obj, "map"));
    }

    if (!result.success) {
      if (attempt <= 3) {
        console.warn(`[gemini] Schema validation failed on attempt ${attempt}, retrying...`);
        return generateJson(parts, schema, systemInstruction, kind, attempt + 1);
      }
      const keys =
        parsed && typeof parsed === "object"
          ? Object.keys(parsed as object).join(",")
          : typeof parsed;
      throw new Error(
        `Gemini JSON failed schema (keys=${keys}): ${result.error.message}. Raw: ${text.slice(0, 400)}`,
      );
    }
    return result.data;
  } catch (err: any) {
    const errStr = String(err?.message || "");
    const isServiceUnavailable =
      errStr.includes("503") ||
      errStr.includes("high demand") ||
      errStr.includes("overloaded") ||
      errStr.includes("timed out") ||
      errStr.includes("timeout") ||
      errStr.includes("500") ||
      errStr.includes("504");

    const isQuotaOrRateLimit =
      errStr.includes("429") ||
      errStr.includes("RESOURCE_EXHAUSTED") ||
      errStr.includes("quota") ||
      errStr.includes("rate-limit");

    if (isQuotaOrRateLimit || isServiceUnavailable) {
      console.warn(`[gemini] Server/Quota event on ${currentModel} (attempt ${attempt}: ${errStr.slice(0, 70)}). Rotating model & key...`);
      rotateModel();
      rotateKey();
      const waitMs = isQuotaOrRateLimit ? extractRetryDelayMs(err) : 2000;
      if (attempt <= 6) {
        await new Promise((r) => setTimeout(r, Math.min(waitMs, 4000)));
        return generateJson(parts, schema, systemInstruction, kind, attempt + 1);
      }
    }

    if (attempt <= 4 && !errStr.includes("GEMINI_API_KEY is not set")) {
      console.warn(`[gemini] Call failed on attempt ${attempt} (${errStr.slice(0, 100)}), retrying in 2s...`);
      await new Promise((r) => setTimeout(r, 2000));
      return generateJson(parts, schema, systemInstruction, kind, attempt + 1);
    }
    throw err;
  }
}

export async function validateDocuments(args: {
  questionPaper: StoredFile;
  answerSheet: StoredFile;
  answerPreviewPage?: StoredPage;
}): Promise<ValidateDocumentsResult> {
  const parts: ContentPart[] = [
    {
      text: "Validate these two uploads for question extraction and answer mapping. Be concise.",
    },
    { text: `QUESTION_PAPER filename: ${args.questionPaper.name}` },
    filePart(args.questionPaper),
  ];

  if (args.answerPreviewPage) {
    parts.push({
      text: `ANSWER_SHEET filename: ${args.answerSheet.name} (page ${args.answerPreviewPage.page} preview):`,
    });
    parts.push(pagePart(args.answerPreviewPage));
  } else {
    parts.push({ text: `ANSWER_SHEET filename: ${args.answerSheet.name}` });
    parts.push(filePart(args.answerSheet));
  }

  return generateJson(
    parts,
    validateDocumentsResultSchema,
    VALIDATE_DOCUMENTS_PROMPT +
      "\nAlways include questionPaper and answerSheet objects.",
    "validate",
  );
}

export async function extractQuestions(
  questionPaper: StoredFile,
): Promise<ExtractQuestionsResult> {
  return generateJson(
    [
      {
        text: 'Extract the full structure: totalPaperMarks, duration, generalInstructions, sections (name, questionRange, marksPerQuestion, totalMarks, isCompulsory), and all questions & subparts with section & maxMarks.',
      },
      filePart(questionPaper),
    ],
    extractQuestionsResultSchema,
    EXTRACT_QUESTIONS_PROMPT,
    "extract",
  );
}

export async function extractHandwrittenAnswers(
  pages: StoredPage[],
): Promise<ExtractAnswersResult> {
  const allAnswers: ExtractAnswersResult["answers"] = [];
  let studentName: string | undefined;
  let rollNumber: string | undefined;

  const pageLimit = Number(process.env.MAP_MAX_PAGES || 6);
  const targetPages = pages.slice(0, Math.max(1, pageLimit));

  console.log(`   📄 Extracting handwriting & bounding boxes across ${targetPages.length} pages (page-by-page)...`);

  for (let i = 0; i < targetPages.length; i++) {
    const pageNum = targetPages[i].page || (i + 1);
    const prompt = EXTRACT_PAGE_ANSWERS_PROMPT.replace(/\{\{PAGE_NUMBER\}\}/g, String(pageNum));

    const res = await generateJson(
      [
        { text: prompt },
        pagePart(targetPages[i]),
      ],
      extractAnswersResultSchema,
      `You transcribe handwriting and detect exact bounding boxes for page ${pageNum}.`,
      "answers",
    );

    if (!studentName && res.studentName) studentName = res.studentName;
    if (!rollNumber && res.rollNumber) rollNumber = res.rollNumber;
    if (Array.isArray(res.answers)) {
      allAnswers.push(...res.answers.map((a, idx) => ({
        ...a,
        id: a.id || `p${pageNum}_ans_${idx + 1}`,
        page: pageNum,
      })));
    }
  }

  return {
    studentName,
    rollNumber,
    answers: allAnswers,
  };
}

async function mapAnswersChunk(
  questions: ExtractQuestionsResult["questions"],
  extractedAnswers: ExtractAnswersResult["answers"],
  groundingNotes?: string,
): Promise<MapAndGradeResult> {
  const questionsJson = JSON.stringify(questions, null, 2);
  const answersJson = JSON.stringify(extractedAnswers, null, 2);

  const parts: ContentPart[] = [
    { text: buildMapAndGradePrompt(questionsJson, answersJson, groundingNotes) },
  ];

  return generateJson(
    parts,
    mapAndGradeResultSchema,
    "You are an expert exam grader. Map student answers to question numbers, award marks (0 to maxMarks), and write clear feedback. Return complete JSON.",
    "map",
  );
}

export async function mapAnswersAndGrade(
  questions: ExtractQuestionsResult["questions"],
  extractedAnswers: ExtractAnswersResult["answers"],
  groundingNotes?: string,
): Promise<MapAndGradeResult> {
  if (questions.length <= 18) {
    return mapAnswersChunk(questions, extractedAnswers, groundingNotes);
  }

  // Batching for large papers (>18 questions) to guarantee fast and reliable execution
  const chunkSize = 15;
  const chunks: ExtractQuestionsResult["questions"][] = [];
  for (let i = 0; i < questions.length; i += chunkSize) {
    chunks.push(questions.slice(i, i + chunkSize));
  }

  console.log(`   📦 Processing answer mapping in ${chunks.length} batches (${questions.length} questions total)...`);

  const combinedMappedAnswers: MapAndGradeResult["answers"] = [];
  const combinedUnmappedAnswers: MapAndGradeResult["unmappedAnswers"] = [];
  let studentName: string | undefined;
  let rollNumber: string | undefined;

  for (let idx = 0; idx < chunks.length; idx++) {
    console.log(`   ⏳ Batch [${idx + 1}/${chunks.length}] (${chunks[idx].length} questions)...`);
    const res = await mapAnswersChunk(chunks[idx], extractedAnswers, groundingNotes);
    if (!studentName && res.studentName) studentName = res.studentName;
    if (!rollNumber && res.rollNumber) rollNumber = res.rollNumber;
    combinedMappedAnswers.push(...res.answers);
    if (res.unmappedAnswers && idx === chunks.length - 1) {
      combinedUnmappedAnswers.push(...res.unmappedAnswers);
    }
  }

  return {
    studentName,
    rollNumber,
    answers: combinedMappedAnswers,
    unmappedAnswers: combinedUnmappedAnswers,
    overallFeedback: "Evaluation completed successfully across all question sections.",
  };
}

export function hasGeminiKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}
