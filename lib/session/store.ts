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
  "map_answers",
  "grade_feedback",
  "complete",
];

const globalStore = globalThis as typeof globalThis & {
  __vedaSessions?: Map<string, SessionRecord>;
};

function sessions(): Map<string, SessionRecord> {
  if (!globalStore.__vedaSessions) {
    globalStore.__vedaSessions = new Map();
  }
  return globalStore.__vedaSessions;
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
  return record;
}

export function getSession(id: string): SessionRecord | undefined {
  return sessions().get(id);
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
  sessions().set(id, record);
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
  return record;
}

export function getPage(id: string, page: number): StoredPage | undefined {
  const record = sessions().get(id);
  if (!record) return undefined;
  return record.answerPages.find((p) => p.page === page);
}

function mustGet(id: string): SessionRecord {
  const record = sessions().get(id);
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
