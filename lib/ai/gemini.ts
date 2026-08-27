import { GoogleGenAI } from "@google/genai";
import type { StoredFile, StoredPage } from "@/lib/types/evaluation";
import {
  EXTRACT_QUESTIONS_PROMPT,
  VALIDATE_DOCUMENTS_PROMPT,
  buildMapAndGradePrompt,
} from "@/lib/ai/prompts";
import {
  extractQuestionsResultSchema,
  mapAndGradeResultSchema,
  validateDocumentsResultSchema,
  type ExtractQuestionsResult,
  type MapAndGradeResult,
  type ValidateDocumentsResult,
} from "@/lib/ai/schemas";

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to .env.local or use demo mode.",
    );
  }
  return new GoogleGenAI({ apiKey });
}

function modelName() {
  return process.env.GEMINI_MODEL || "gemini-3.6-flash";
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

  // Prefer a full object/array value if the model returned bare JSON.
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
  return trimmed;
}

/** Normalize common Gemini shape drift before Zod. */
function normalizeModelJson(
  parsed: unknown,
  kind: "validate" | "extract" | "map",
): unknown {
  if (kind === "extract") {
    if (Array.isArray(parsed)) {
      return { questions: parsed.map(normalizeExtractedQuestion) };
    }
    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      const list = obj.questions ?? obj.items ?? obj.data;
      if (Array.isArray(list)) {
        return { ...obj, questions: list.map(normalizeExtractedQuestion) };
      }
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
    return {
      ...obj,
      answers: answers.map(normalizeMappedAnswer),
      unmappedAnswers: unmapped.map(normalizeUnmappedAnswer),
    };
  }

  return parsed;
}

function normalizeExtractedQuestion(q: unknown) {
  if (!q || typeof q !== "object") return q;
  const o = q as Record<string, unknown>;
  return {
    number: String(o.number ?? o.label ?? o.id ?? ""),
    title: o.title,
    questionText: String(
      o.questionText ?? o.text ?? o.question ?? o.prompt ?? "",
    ),
    maxMarks: Number(o.maxMarks ?? o.max_marks ?? o.marks ?? 0) || 0,
  };
}

function normalizeMappedAnswer(a: unknown) {
  if (!a || typeof a !== "object") return a;
  const o = a as Record<string, unknown>;
  const regions = Array.isArray(o.regions)
    ? o.regions.map(normalizeRegion)
    : [];
  return {
    questionNumber: String(
      o.questionNumber ?? o.number ?? o.question_id ?? o.id ?? "",
    ),
    studentAnswer: String(
      o.studentAnswer ??
        o.transcription ??
        o.answer ??
        o.text ??
        o.student_answer ??
        "",
    ),
    regions,
    status: normalizeStatus(o.status),
    marksObtained: Number(o.marksObtained ?? o.score ?? o.marks ?? 0) || 0,
    maxMarks: Number(o.maxMarks ?? o.max_marks ?? o.maxScore ?? 0) || 0,
    aiRemarks: String(o.aiRemarks ?? o.feedback ?? o.remarks ?? ""),
    modelAnswer:
      o.modelAnswer != null ? String(o.modelAnswer) : undefined,
    confidence:
      o.confidence != null ? Number(o.confidence) : undefined,
  };
}

function normalizeUnmappedAnswer(a: unknown) {
  if (!a || typeof a !== "object") return a;
  const o = a as Record<string, unknown>;
  return {
    transcription: String(
      o.transcription ?? o.studentAnswer ?? o.text ?? o.answer ?? "",
    ),
    regions: Array.isArray(o.regions) ? o.regions.map(normalizeRegion) : [],
  };
}

function normalizeRegion(r: unknown) {
  if (!r || typeof r !== "object") return r;
  const o = r as Record<string, unknown>;
  const box = o.box_2d ?? o.box2d ?? o.bbox ?? o.box;
  return {
    page: Number(o.page ?? 1) || 1,
    box_2d: Array.isArray(box) ? box.map(Number) : [0, 0, 0, 0],
  };
}

function normalizeStatus(status: unknown) {
  const s = String(status ?? "unanswered").toLowerCase();
  if (s === "correct" || s === "partial" || s === "incorrect" || s === "unanswered") {
    return s;
  }
  if (s === "full" || s === "right") return "correct";
  if (s === "wrong" || s === "incorrect") return "incorrect";
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
  kind: "validate" | "extract" | "map" = "map",
): Promise<T> {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: modelName(),
    contents: [{ role: "user", parts }],
    config: {
      systemInstruction,
      temperature: 0.1,
      responseMimeType: "application/json",
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Gemini returned an empty response");
  }

  let parsed: unknown;
  try {
    parsed = normalizeModelJson(JSON.parse(extractJsonText(text)), kind);
  } catch {
    throw new Error(`Gemini returned invalid JSON: ${text.slice(0, 500)}`);
  }

  if (typeof schema.safeParse === "function") {
    const result = schema.safeParse(parsed);
    if (!result.success) {
      const keys =
        parsed && typeof parsed === "object"
          ? Object.keys(parsed as object).join(",")
          : typeof parsed;
      throw new Error(
        `Gemini JSON failed schema (keys=${keys}): ${result.error.message}. Raw: ${text.slice(0, 400)}`,
      );
    }
    return result.data;
  }

  return schema.parse(parsed);
}

export async function validateDocuments(args: {
  questionPaper: StoredFile;
  answerSheet: StoredFile;
  answerPreviewPage?: StoredPage;
}): Promise<ValidateDocumentsResult> {
  const parts: ContentPart[] = [
    {
      text: "Validate these two uploads for question extraction and answer mapping.",
    },
    { text: `QUESTION_PAPER filename: ${args.questionPaper.name}` },
    filePart(args.questionPaper),
    { text: `ANSWER_SHEET filename: ${args.answerSheet.name}` },
    filePart(args.answerSheet),
  ];

  if (args.answerPreviewPage) {
    parts.push({
      text: `ANSWER_SHEET page ${args.answerPreviewPage.page} (raster preview):`,
    });
    parts.push(pagePart(args.answerPreviewPage));
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
        text: 'Extract all questions. Return JSON object: {"title":"...","subject":"...","grade":"...","questions":[{"number":"1","questionText":"...","maxMarks":2}]}',
      },
      filePart(questionPaper),
    ],
    extractQuestionsResultSchema,
    EXTRACT_QUESTIONS_PROMPT,
    "extract",
  );
}

export async function mapAnswersAndGrade(
  pages: StoredPage[],
  questions: ExtractQuestionsResult["questions"],
  groundingNotes?: string,
): Promise<MapAndGradeResult> {
  const questionsJson = JSON.stringify(questions, null, 2);
  const parts: ContentPart[] = [
    { text: buildMapAndGradePrompt(questionsJson, groundingNotes) },
  ];

  for (const page of pages) {
    parts.push({ text: `Answer sheet page ${page.page}:` });
    parts.push(pagePart(page));
  }

  return generateJson(
    parts,
    mapAndGradeResultSchema,
    "You grade handwritten exam scripts with precise spatial grounding. Use any provided research brief. Return one JSON object with answers and unmappedAnswers arrays.",
    "map",
  );
}

export function hasGeminiKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}
