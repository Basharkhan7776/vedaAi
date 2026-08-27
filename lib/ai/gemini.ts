import { GoogleGenAI } from "@google/genai";
import type { StoredFile, StoredPage } from "@/lib/types/evaluation";
import {
  EXTRACT_QUESTIONS_PROMPT,
  buildMapAndGradePrompt,
} from "@/lib/ai/prompts";
import {
  extractQuestionsResultSchema,
  mapAndGradeResultSchema,
  type ExtractQuestionsResult,
  type MapAndGradeResult,
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
  return process.env.GEMINI_MODEL || "gemini-2.5-flash";
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

async function generateJson<T>(
  parts: ContentPart[],
  schema: { parse: (data: unknown) => T },
  systemInstruction: string,
): Promise<T> {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: modelName(),
    contents: [{ role: "user", parts }],
    config: {
      systemInstruction,
      temperature: 0.2,
      responseMimeType: "application/json",
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Gemini returned an empty response");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Gemini returned invalid JSON: ${text.slice(0, 400)}`);
  }

  return schema.parse(parsed);
}

export async function extractQuestions(
  questionPaper: StoredFile,
): Promise<ExtractQuestionsResult> {
  return generateJson(
    [
      { text: "Extract all questions from this question paper." },
      filePart(questionPaper),
    ],
    extractQuestionsResultSchema,
    EXTRACT_QUESTIONS_PROMPT,
  );
}

export async function mapAnswersAndGrade(
  pages: StoredPage[],
  questions: ExtractQuestionsResult["questions"],
): Promise<MapAndGradeResult> {
  const questionsJson = JSON.stringify(questions, null, 2);
  const parts: ContentPart[] = [
    { text: buildMapAndGradePrompt(questionsJson) },
  ];

  for (const page of pages) {
    parts.push({ text: `Answer sheet page ${page.page}:` });
    parts.push(pagePart(page));
  }

  return generateJson(
    parts,
    mapAndGradeResultSchema,
    "You grade handwritten exam scripts with precise spatial grounding.",
  );
}

export function hasGeminiKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}
