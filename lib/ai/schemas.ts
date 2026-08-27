import { z } from "zod";

export const extractedQuestionSchema = z.object({
  number: z
    .string()
    .describe('Original label e.g. "1", "11(a)", "Q3". Sub-parts are separate.'),
  title: z.string().nullish(),
  questionText: z.string(),
  maxMarks: z.number().min(1).default(1),
});

export const extractQuestionsResultSchema = z.object({
  title: z.string().nullish(),
  subject: z.string().nullish(),
  grade: z.string().nullish(),
  questions: z.array(extractedQuestionSchema).min(1),
});

export const answerRegionSchema = z.object({
  page: z.number().int().positive(),
  box_2d: z
    .array(z.number())
    .length(4)
    .describe("[ymin, xmin, ymax, xmax] normalized 0-1000"),
});

export const extractedAnswerItemSchema = z.object({
  label: z
    .string()
    .nullish()
    .describe('Visible label written by student e.g. "Ans 1", "Q.2", "11(a)", "3"'),
  transcription: z
    .string()
    .describe("Full transcription of the student handwritten text / steps"),
  page: z.number().int().positive().default(1),
  box_2d: z
    .array(z.number())
    .length(4)
    .describe("[ymin, xmin, ymax, xmax] normalized 0-1000 on that page"),
});

export const extractAnswersResultSchema = z.object({
  studentName: z.string().nullish(),
  rollNumber: z.string().nullish(),
  answers: z.array(extractedAnswerItemSchema).default([]),
});

export const mappedAnswerSchema = z.object({
  questionNumber: z
    .string()
    .describe("Must match an extracted question number string"),
  studentAnswer: z.string().default(""),
  regions: z.array(answerRegionSchema).default([]),
  status: z.enum(["correct", "partial", "incorrect", "unanswered"]),
  marksObtained: z.number().nonnegative().default(0),
  maxMarks: z.number().min(1).default(1),
  aiRemarks: z.string().default(""),
  modelAnswer: z.string().nullish(),
  confidence: z.number().min(0).max(100).nullish(),
});

export const unmappedAnswerSchema = z.object({
  transcription: z.string().default(""),
  regions: z.array(answerRegionSchema).default([]),
});

export const mapAndGradeResultSchema = z.object({
  studentName: z.string().nullish(),
  rollNumber: z.string().nullish(),
  answers: z.array(mappedAnswerSchema).default([]),
  unmappedAnswers: z.array(unmappedAnswerSchema).default([]),
  overallFeedback: z.string().nullish(),
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
export type ExtractAnswersResult = z.infer<typeof extractAnswersResultSchema>;
export type MapAndGradeResult = z.infer<typeof mapAndGradeResultSchema>;
export type ValidateDocumentsResult = z.infer<
  typeof validateDocumentsResultSchema
>;
