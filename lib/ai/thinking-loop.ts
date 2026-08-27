import { jsonrepair } from "jsonrepair";
import { z } from "zod";
import { getClient, modelName, rotateKey } from "@/lib/ai/gemini";
import type { ExtractQuestionsResult } from "@/lib/ai/schemas";
import type { GroundingBrief, ThinkingStep } from "@/lib/types/evaluation";

const fastBriefSchema = z.object({
  subjectGuess: z.string().default("General"),
  researchQueries: z.array(z.string()).default([]),
  thinking: z.string().default(""),
  rubricNotes: z.string().default(""),
  conceptNotes: z.string().default(""),
  gradingGuidance: z.string().default(""),
});

function enableGoogleSearch() {
  return (
    process.env.ENABLE_GOOGLE_SEARCH === "1" ||
    process.env.ENABLE_GOOGLE_SEARCH === "true"
  );
}

function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced?.[1]?.trim() || trimmed;
  try {
    return JSON.parse(body);
  } catch {
    try {
      return JSON.parse(jsonrepair(body));
    } catch {
      const start = body.indexOf("{");
      const end = body.lastIndexOf("}");
      const json = start >= 0 && end > start ? body.slice(start, end + 1) : body;
      return JSON.parse(jsonrepair(json));
    }
  }
}

async function callThinkingModel(prompt: string, attempt = 1): Promise<string> {
  try {
    const res = await getClient().models.generateContent({
      model: modelName(),
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        temperature: 0.1,
        responseMimeType: "application/json",
        maxOutputTokens: 16384,
      },
    });
    return res.text || "{}";
  } catch (err: any) {
    const errStr = String(err?.message || "");
    const isQuota =
      errStr.includes("429") ||
      errStr.includes("RESOURCE_EXHAUSTED") ||
      errStr.includes("quota") ||
      errStr.includes("rate-limit");

    if (isQuota) {
      console.warn(`[thinking-loop] Rate limit hit on attempt ${attempt}. Rotating API key...`);
      rotateKey();
    }

    if (attempt <= 3) {
      console.warn(`[thinking-loop] Retrying attempt ${attempt + 1}...`);
      await new Promise((r) => setTimeout(r, 1200));
      return callThinkingModel(prompt, attempt + 1);
    }
    throw err;
  }
}

export async function runGroundedThinkingLoop(args: {
  extracted: ExtractQuestionsResult;
}): Promise<GroundingBrief> {
  const steps: ThinkingStep[] = [];
  const questions = args.extracted.questions
    .slice(0, 10)
    .map(
      (q) =>
        `${q.number} (${q.maxMarks || 1} marks): ${q.questionText.slice(0, 140)}`,
    )
    .join("\n");

  const prompt = `You are a fast exam-grading research agent.
Paper: ${args.extracted.title || "Unknown"} | Subject: ${args.extracted.subject || "Unknown"} | Grade: ${args.extracted.grade || "Unknown"}

Questions:
${questions}

Think briefly, then return JSON ONLY:
{
  "subjectGuess": "...",
  "researchQueries": ["optional query"],
  "thinking": "1-2 sentences",
  "rubricNotes": "how to award full/partial marks for these questions",
  "conceptNotes": "key expected points",
  "gradingGuidance": "practical compare-to-student-answer tips"
}`;

  let brief = {
    subjectGuess: args.extracted.subject || "General",
    researchQueries: [] as string[],
    thinking: "Prepared grading guidance from the question paper.",
    rubricNotes: "Award marks based on complete conceptual steps.",
    conceptNotes: "Key expected points aligned with question paper.",
    gradingGuidance: "Compare student steps against standard rubric.",
  };

  try {
    const planText = await callThinkingModel(prompt);
    brief = fastBriefSchema.parse(extractJson(planText));
  } catch (thinkErr) {
    console.warn("[thinking-loop] Fallback to default rubric brief:", thinkErr instanceof Error ? thinkErr.message : thinkErr);
  }

  steps.push({
    id: "think",
    label: "Thinking",
    detail: brief.thinking || "Prepared grading guidance from the question paper.",
  });

  let usedGoogleSearch = false;
  let searchNotes = "";
  const sources: string[] = [];

  // Optional Google Search
  if (enableGoogleSearch() && brief.researchQueries.length > 0) {
    try {
      const searchRes = await getClient().models.generateContent({
        model: modelName(),
        contents: `Use Google Search. Subject: ${brief.subjectGuess}.
Queries:\n${brief.researchQueries.map((q) => `- ${q}`).join("\n")}
Return concise bullet marking guidance only.`,
        config: {
          temperature: 0.1,
          tools: [{ googleSearch: {} }],
          maxOutputTokens: 8192,
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
        detail: searchNotes.slice(0, 800) || "Search completed.",
        sources: sources.slice(0, 6),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Search unavailable";
      steps.push({
        id: "search",
        label: "Google Search grounding (skipped)",
        detail: message.slice(0, 200),
      });
    }
  } else {
    steps.push({
      id: "search",
      label: "Google Search grounding (skipped)",
      detail:
        "Disabled for speed. Set ENABLE_GOOGLE_SEARCH=true to turn on live grounding.",
    });
  }

  steps.push({
    id: "synthesize",
    label: "Synthesize grader brief",
    detail: [brief.rubricNotes, brief.conceptNotes, brief.gradingGuidance]
      .filter(Boolean)
      .join("\n")
      .slice(0, 1000),
  });

  return {
    subjectGuess: brief.subjectGuess,
    researchQueries: brief.researchQueries,
    rubricNotes: brief.rubricNotes,
    conceptNotes: [brief.conceptNotes, brief.gradingGuidance, searchNotes]
      .filter(Boolean)
      .join("\n"),
    thinkingSteps: steps,
    usedGoogleSearch,
  };
}

export function formatGroundingForPrompt(brief: GroundingBrief): string {
  return `GROUNDED RESEARCH BRIEF (agent thinking${brief.usedGoogleSearch ? " + Google Search" : ""}):
Subject: ${brief.subjectGuess}

Rubric notes:
${brief.rubricNotes}

Concept / grading guidance:
${brief.conceptNotes}

Use this brief to improve marking accuracy. Still ground final scores in the student's actual written answer.`;
}
