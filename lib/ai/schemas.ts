import { z } from "zod";

export const extractedQuestionSchema = z.object({
  number: z
    .string()
    .describe('Original label e.g. "1", "11(a)", "Q3". Sub-parts are separate.'),
  title: z.string().optional(),
  questionText: z.string(),
  maxMarks: z.number().nonnegative().optional().default(0),
});

export const extractQuestionsResultSchema = z.object({
  title: z.string().optional(),
  subject: z.string().optional(),
  grade: z.string().optional(),
  questions: z.array(extractedQuestionSchema).min(1),
});

export const answerRegionSchema = z.object({
  page: z.number().int().positive(),
  box_2d: z
    .array(z.number())
    .length(4)
    .describe("[ymin, xmin, ymax, xmax] normalized 0-1000"),
});

export const mappedAnswerSchema = z.object({
  questionNumber: z
    .string()
    .describe("Must match an extracted question number string"),
  studentAnswer: z.string(),
  regions: z.array(answerRegionSchema),
  status: z.enum(["correct", "partial", "incorrect", "unanswered"]),
  marksObtained: z.number().nonnegative(),
  maxMarks: z.number().nonnegative(),
  aiRemarks: z.string(),
  modelAnswer: z.string().optional(),
  confidence: z.number().min(0).max(100).optional(),
});

export const unmappedAnswerSchema = z.object({
  transcription: z.string(),
  regions: z.array(answerRegionSchema).min(1),
});

export const mapAndGradeResultSchema = z.object({
  studentName: z.string().optional(),
  rollNumber: z.string().optional(),
  answers: z.array(mappedAnswerSchema),
  unmappedAnswers: z.array(unmappedAnswerSchema).default([]),
  overallFeedback: z.string().optional(),
});

export const documentIssueSchema = z.object({
  file: z.enum(["questionPaper", "answerSheet", "both"]),
  code: z.enum([
    "not_question_paper",
    "not_answer_sheet",
    "blank_or_unreadable",
    "wrong_subject_or_mismatch",
    "corrupted_or_unreadable",
    "other",
  ]),
  message: z.string(),
  suggestions: z.array(z.string()).default([]),
});

export const validateDocumentsResultSchema = z.object({
  questionPaper: z.object({
    isValidQuestionPaper: z.boolean(),
    confidence: z.number().min(0).max(100),
    notes: z.string(),
  }),
  answerSheet: z.object({
    isValidAnswerSheet: z.boolean(),
    confidence: z.number().min(0).max(100),
    notes: z.string(),
  }),
  pairLooksCompatible: z.boolean(),
  issues: z.array(documentIssueSchema).default([]),
  suggestions: z.array(z.string()).default([]),
});

export type ExtractQuestionsResult = z.infer<typeof extractQuestionsResultSchema>;
export type MapAndGradeResult = z.infer<typeof mapAndGradeResultSchema>;
export type ValidateDocumentsResult = z.infer<
  typeof validateDocumentsResultSchema
>;
