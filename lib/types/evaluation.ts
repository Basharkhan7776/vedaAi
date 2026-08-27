/** Shared evaluation types for API + UI. See AGENTS.md. */

export type BoxPct = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type AnswerRegion = {
  page: number;
  box: BoxPct;
};

export type QuestionStatus =
  | "correct"
  | "partial"
  | "incorrect"
  | "unanswered";

export type RubricStep = {
  step: number;
  description: string;
  marks: number;
  awarded: number;
  status: "full" | "partial" | "none";
  note?: string;
};

export type MappedQuestion = {
  id: string;
  number: string;
  questionNumber: number;
  title: string;
  questionText: string;
  maxMarks: number;
  marksObtained: number;
  status: QuestionStatus;
  studentAnswer: string;
  studentAnswerTranscription: string;
  modelAnswer: string;
  aiRemarks: string;
  teacherRemarks?: string;
  confidence: number;
  rubric: RubricStep[];
  regions: AnswerRegion[];
  /** Derived from regions[0] for DocumentViewer compatibility */
  page: number;
  boundingBox: BoxPct;
};

export type UnmappedAnswer = {
  id: string;
  transcription: string;
  regions: AnswerRegion[];
};

export type EvaluationSession = {
  id: string;
  title: string;
  subject: string;
  grade: string;
  studentName: string;
  rollNumber: string;
  date: string;
  totalMarks: number;
  maxMarks: number;
  percentage: number;
  gradeBadge: string;
  totalPages: number;
  questions: MappedQuestion[];
  unmappedAnswers: UnmappedAnswer[];
};

export type PipelineStage =
  | "queued"
  | "ingest_rasterize"
  | "extract_questions"
  | "map_answers"
  | "grade_feedback"
  | "complete"
  | "error";

export type SessionStatus = {
  id: string;
  stage: PipelineStage;
  stageIndex: number;
  stageLabel: string;
  progress: number;
  error?: string;
  ready: boolean;
};

export type StoredPage = {
  page: number;
  mimeType: string;
  bytes: Buffer;
};

export type StoredFile = {
  name: string;
  mimeType: string;
  bytes: Buffer;
};

export type SessionRecord = {
  id: string;
  createdAt: number;
  status: SessionStatus;
  questionPaper?: StoredFile;
  answerSheet?: StoredFile;
  answerPages: StoredPage[];
  evaluation?: EvaluationSession;
};
