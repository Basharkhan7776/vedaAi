import type {
  EvaluationSession,
  PipelineStage,
  SessionFailure,
  SessionRecord,
  SessionStatus,
  StoredFile,
  StoredPage,
} from "@/lib/types/evaluation";

const STAGE_LABELS: Record<PipelineStage, string> = {
  queued: "Queued…",
  ingest_rasterize: "Ingesting & rendering answer sheet pages…",
  validate_documents: "Checking that uploaded files look like a QP and answer sheet…",
  extract_questions: "Extracting questions from the question paper…",
  thinking_loop: "Agent thinking + Google Search grounding…",
  map_answers: "Mapping handwritten answers to questions…",
  grade_feedback: "Scoring answers & generating AI feedback…",
  complete: "Evaluation complete",
  failed: "Documents could not be mapped",
  error: "Evaluation failed",
};

/** Progress path for happy-path stages only */
const STAGE_ORDER: PipelineStage[] = [
  "queued",
  "ingest_rasterize",
  "validate_documents",
  "extract_questions",
  "thinking_loop",
  "map_answers",
  "grade_feedback",
  "complete",
];

import fs from "fs";
import path from "path";

const globalStore = globalThis as typeof globalThis & {
  __vedaSessions?: Map<string, SessionRecord>;
};

const TMP_DIR = "/tmp";
const TMP_SESSIONS_FILE = path.join(TMP_DIR, "vedaSessions.json");

function sessions(): Map<string, SessionRecord> {
  if (!globalStore.__vedaSessions) {
    globalStore.__vedaSessions = new Map();
    // Try to load persisted lightweight session metadata from /tmp if available
    try {
      if (fs.existsSync(TMP_SESSIONS_FILE)) {
        const raw = fs.readFileSync(TMP_SESSIONS_FILE, "utf-8");
        const json = JSON.parse(raw);
        for (const [id, rec] of Object.entries(json)) {
          globalStore.__vedaSessions.set(id, rec as SessionRecord);
        }
      }
    } catch {
      // Ignore /tmp read errors
    }
  }
  return globalStore.__vedaSessions;
}

function persistToDisk() {
  try {
    const obj: Record<string, unknown> = {};
    for (const [id, rec] of sessions().entries()) {
      // Store lightweight representation without raw PDF buffers to prevent excessive disk IO
      obj[id] = {
        id: rec.id,
        createdAt: rec.createdAt,
        status: rec.status,
        evaluation: rec.evaluation,
        failure: rec.failure,
        pageImages: rec.pageImages,
      };
    }
    fs.writeFileSync(TMP_SESSIONS_FILE, JSON.stringify(obj));
  } catch {
    // Ignore /tmp write errors
  }
}

export function createSessionId(): string {
  return `session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createSession(): SessionRecord {
  const id = createSessionId();
  const record: SessionRecord = {
    id,
    createdAt: Date.now(),
    status: buildStatus(id, "queued"),
    answerPages: [],
  };
  sessions().set(id, record);
  persistToDisk();
  return record;
}

export function getSession(id: string): SessionRecord | undefined {
  let rec = sessions().get(id);
  if (!rec) {
    // Try disk lookup
    try {
      if (fs.existsSync(TMP_SESSIONS_FILE)) {
        const raw = fs.readFileSync(TMP_SESSIONS_FILE, "utf-8");
        const json = JSON.parse(raw);
        if (json[id]) {
          rec = json[id] as SessionRecord;
          rec.answerPages = rec.answerPages || [];
          sessions().set(id, rec);
        }
      }
    } catch {
      // Ignore
    }
  }
  return rec;
}

export function setSessionFiles(
  id: string,
  questionPaper: StoredFile,
  answerSheet: StoredFile,
): SessionRecord {
  const record = mustGet(id);
  record.questionPaper = questionPaper;
  record.answerSheet = answerSheet;
  sessions().set(id, record);
  return record;
}

export function setAnswerPages(id: string, pages: StoredPage[]): SessionRecord {
  const record = mustGet(id);
  record.answerPages = pages;
  record.pageImages = pages.map(
    (p) => `data:image/png;base64,${p.bytes.toString("base64")}`,
  );
  sessions().set(id, record);
  persistToDisk();
  return record;
}

export function setSessionStage(
  id: string,
  stage: PipelineStage,
  error?: string,
): SessionStatus {
  const record = mustGet(id);
  record.status = buildStatus(id, stage, error);
  sessions().set(id, record);
  persistToDisk();
  return record.status;
}

export function setEvaluation(
  id: string,
  evaluation: EvaluationSession,
): SessionRecord {
  const record = mustGet(id);
  record.evaluation = evaluation;
  record.failure = undefined;
  record.status = buildStatus(id, "complete");
  sessions().set(id, record);
  persistToDisk();
  return record;
}

export function setSessionFailure(
  id: string,
  failure: SessionFailure,
): SessionRecord {
  const record = mustGet(id);
  record.failure = failure;
  record.evaluation = undefined;
  record.status = buildStatus(id, "failed", failure.summary);
  sessions().set(id, record);
  persistToDisk();
  return record;
}

export function getPage(id: string, page: number): StoredPage | undefined {
  const record = getSession(id);
  if (!record) return undefined;
  return record.answerPages?.find((p) => p.page === page);
}

function mustGet(id: string): SessionRecord {
  const record = getSession(id);
  if (!record) throw new Error(`Unknown session: ${id}`);
  return record;
}

function buildStatus(
  id: string,
  stage: PipelineStage,
  error?: string,
): SessionStatus {
  const orderIndex = STAGE_ORDER.indexOf(stage);
  const stageIndex =
    orderIndex >= 0 ? orderIndex : STAGE_ORDER.length - 1;
  const progress =
    stage === "error"
      ? 0
      : stage === "failed"
        ? 100
        : stage === "complete"
          ? 100
          : Math.round((stageIndex / (STAGE_ORDER.length - 1)) * 100);

  return {
    id,
    stage,
    stageIndex,
    stageLabel: error ? error : STAGE_LABELS[stage],
    progress,
    error,
    ready: stage === "complete",
    terminal: stage === "complete" || stage === "failed" || stage === "error",
  };
}

export { STAGE_LABELS, STAGE_ORDER };
