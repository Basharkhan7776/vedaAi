import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import type { ExtractQuestionsResult } from "@/lib/ai/schemas";
import type { GroundingBrief, ThinkingStep } from "@/lib/types/evaluation";

const planSchema = z.object({
  subjectGuess: z.string().default("General"),
  researchQueries: z.array(z.string()).min(1).max(5),
  thinking: z.string().default(""),
});

const synthesizeSchema = z.object({
  rubricNotes: z.string().default(""),
  conceptNotes: z.string().default(""),
  gradingGuidance: z.string().default(""),
});

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenAI({ apiKey });
}

function modelName() {
  return process.env.GEMINI_MODEL || "gemini-3.6-flash";
}

function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced?.[1]?.trim() || trimmed;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  const json = start >= 0 && end > start ? body.slice(start, end + 1) : body;
  return JSON.parse(json);
}

/**
 * Agent thinking loop:
 * 1) Plan research queries from extracted questions
 * 2) Google Search grounding (best-effort; continues if quota/tool fails)
 * 3) Synthesize rubric/concept notes for the grader
 */
export async function runGroundedThinkingLoop(args: {
  extracted: ExtractQuestionsResult;
}): Promise<GroundingBrief> {
  const steps: ThinkingStep[] = [];
  const questions = args.extracted.questions
    .slice(0, 12)
    .map(
      (q) =>
        `${q.number} (${q.maxMarks || "?"} marks): ${q.questionText.slice(0, 180)}`,
    )
    .join("\n");

  // ---- Step 1: THINK / PLAN ----
  const planRaw = await getClient().models.generateContent({
    model: modelName(),
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `You are an exam-grading research agent.
Paper title: ${args.extracted.title || "Unknown"}
Subject hint: ${args.extracted.subject || "Unknown"}
Grade hint: ${args.extracted.grade || "Unknown"}

Questions:
${questions}

Think step-by-step about what external knowledge would improve marking (official board patterns, definitions, standard answers).
Return JSON only:
{
  "subjectGuess": "...",
  "researchQueries": ["query1", "query2"],
  "thinking": "short internal reasoning"
}`,
          },
        ],
      },
    ],
    config: {
      temperature: 0.2,
      responseMimeType: "application/json",
    },
  });

  const plan = planSchema.parse(extractJson(planRaw.text || "{}"));
  steps.push({
    id: "think",
    label: "Thinking",
    detail: plan.thinking || "Planned research queries for rubric grounding.",
  });
  steps.push({
    id: "plan",
    label: "Research plan",
    detail: plan.researchQueries.map((q, i) => `${i + 1}. ${q}`).join("\n"),
  });

  // ---- Step 2: GOOGLE SEARCH GROUNDING ----
  let searchNotes = "";
  let usedGoogleSearch = false;
  const sources: string[] = [];

  try {
    const searchPrompt = `Use Google Search to gather concise marking guidance for this exam.

Subject: ${plan.subjectGuess}
Queries to cover:
${plan.researchQueries.map((q) => `- ${q}`).join("\n")}

Questions overview:
${questions}

Return a compact research brief (bullet points) covering:
- Likely board/exam style expectations
- Key concepts / correct answer criteria per theme
- Common student mistakes
Cite sources inline when possible.`;

    const searchRes = await getClient().models.generateContent({
      model: modelName(),
      contents: searchPrompt,
      config: {
        temperature: 0.2,
        tools: [{ googleSearch: {} }],
      },
    });

    searchNotes = (searchRes.text || "").trim();
    usedGoogleSearch = true;

    const chunks =
      searchRes.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    for (const chunk of chunks) {
      const uri = chunk?.web?.uri || chunk?.web?.title;
      if (uri && typeof uri === "string") sources.push(uri);
    }

    steps.push({
      id: "search",
      label: "Google Search grounding",
      detail:
        searchNotes.slice(0, 1200) ||
        "Search tool ran but returned empty text.",
      sources: sources.slice(0, 8),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Search unavailable";
    steps.push({
      id: "search",
      label: "Google Search grounding (skipped)",
      detail: `Continuing without live search: ${message.slice(0, 240)}`,
    });
    // Lightweight non-search fallback thinking
    const fallback = await getClient().models.generateContent({
      model: modelName(),
      contents: `Without web search, write a short grading brief for subject "${plan.subjectGuess}" covering the questions below. Bullets only.\n\n${questions}`,
      config: { temperature: 0.2 },
    });
    searchNotes = (fallback.text || "").trim();
  }

  // ---- Step 3: SYNTHESIZE NOTES FOR GRADER ----
  const synthRaw = await getClient().models.generateContent({
    model: modelName(),
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Convert this research into grader notes.

Subject: ${plan.subjectGuess}
Research brief:
${searchNotes.slice(0, 6000)}

Questions:
${questions}

Return JSON only:
{
  "rubricNotes": "how to award full/partial marks",
  "conceptNotes": "key facts / expected points",
  "gradingGuidance": "practical instructions for comparing student answers"
}`,
          },
        ],
      },
    ],
    config: {
      temperature: 0.1,
      responseMimeType: "application/json",
    },
  });

  const synth = synthesizeSchema.parse(extractJson(synthRaw.text || "{}"));
  steps.push({
    id: "synthesize",
    label: "Synthesize grader brief",
    detail: [synth.rubricNotes, synth.conceptNotes, synth.gradingGuidance]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 1500),
  });

  return {
    subjectGuess: plan.subjectGuess,
    researchQueries: plan.researchQueries,
    rubricNotes: synth.rubricNotes,
    conceptNotes: [synth.conceptNotes, synth.gradingGuidance]
      .filter(Boolean)
      .join("\n"),
    thinkingSteps: steps,
    usedGoogleSearch,
  };
}

export function formatGroundingForPrompt(brief: GroundingBrief): string {
  return `GROUNDED RESEARCH BRIEF (from agent thinking${brief.usedGoogleSearch ? " + Google Search" : ""}):
Subject: ${brief.subjectGuess}
Queries: ${brief.researchQueries.join(" | ")}

Rubric notes:
${brief.rubricNotes}

Concept / grading guidance:
${brief.conceptNotes}

Use this brief to improve marking accuracy. Still ground final scores in the student's actual written answer.`;
}
