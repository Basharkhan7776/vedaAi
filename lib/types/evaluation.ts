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
  | "unanswered"
  | "optional_skipped";

export type RubricStep = {
  step: number;
  description: string;
  marks: number;
  awarded: number;
  status: "full" | "partial" | "none";
  note?: string | null;
};

export type SectionInfo = {
  name: string;
  title?: string | null;
  questionRange?: string | null;
  marksPerQuestion?: number | null;
  totalMarks?: number | null;
  isCompulsory?: boolean;
  instructions?: string | null;
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
  teacherRemarks?: string | null;
  confidence: number;
  rubric: RubricStep[];
  regions: AnswerRegion[];
  /** Derived from regions[0] for DocumentViewer compatibility */
  page: number;
  boundingBox: BoxPct;
  section?: string | null;
  sectionTitle?: string | null;
  parentQuestionNumber?: string | null;
  subPart?: string | null;
  subNumber?: string | null;
  isOptional?: boolean;
  choiceGroup?: string | null;
};

export type UnmappedAnswer = {
  id: string;
  transcription: string;
  regions: AnswerRegion[];
};

export type ThinkingStep = {
  id: string;
  label: string;
  detail: string;
  sources?: string[];
};

export type GroundingBrief = {
  subjectGuess: string;
  researchQueries: string[];
  rubricNotes: string;
  conceptNotes: string;
  thinkingSteps: ThinkingStep[];
  usedGoogleSearch: boolean;
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
  grounding?: GroundingBrief;
  totalPaperMarks?: number | null;
  duration?: string | null;
  sections?: SectionInfo[] | null;
  generalInstructions?: string[] | null;
};

export type DocumentIssueCode =
  | "not_question_paper"
  | "not_answer_sheet"
  | "blank_or_unreadable"
  | "wrong_subject_or_mismatch"
  | "corrupted_or_unreadable"
  | "other";

export type DocumentIssue = {
  file: "questionPaper" | "answerSheet" | "both";
  code: DocumentIssueCode;
  message: string;
  suggestions: string[];
};

export type SessionFailure = {
  title: string;
  summary: string;
  issues: DocumentIssue[];
  suggestions: string[];
};

export type PipelineStage =
  | "queued"
  | "ingest_rasterize"
  | "validate_documents"
  | "extract_questions"
  | "thinking_loop"
  | "map_answers"
  | "grade_feedback"
  | "complete"
  | "failed"
  | "error";

export type SessionStatus = {
  id: string;
  stage: PipelineStage;
  stageIndex: number;
  stageLabel: string;
  progress: number;
  error?: string;
  /** True when evaluation completed successfully */
  ready: boolean;
  /** True when AI rejected docs or infra failed — analyzer can show failed state */
  terminal: boolean;
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

export type PipelineProgressEvent = {
  type: "stage" | "complete" | "failure" | "error";
  sessionId: string;
  stage?: PipelineStage;
  stageIndex?: number;
  stageLabel?: string;
  progress?: number;
  error?: string;
  evaluation?: EvaluationSession;
  failure?: SessionFailure;
  pageImages?: string[];
};

export type SessionRecord = {
  id: string;
  createdAt: number;
  status: SessionStatus;
  questionPaper?: StoredFile;
  answerSheet?: StoredFile;
  answerPages: StoredPage[];
  evaluation?: EvaluationSession;
  failure?: SessionFailure;
  pageImages?: string[];
};
