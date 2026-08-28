import { z } from "zod";

export const sectionInfoSchema = z.object({
  name: z.string().describe('e.g. "Section A", "Section B"'),
  title: z.string().nullish().describe('e.g. "Multiple Choice Questions", "Short Answer"'),
  questionRange: z.string().nullish().describe('e.g. "1-15", "16-22"'),
  marksPerQuestion: z.number().nullish().describe("Standard marks per question in this section"),
  totalMarks: z.number().nullish().describe("Total marks allocated for this entire section"),
  isCompulsory: z.boolean().default(true),
  instructions: z.string().nullish().describe("Section specific instructions or choice rules"),
});

export const extractedQuestionSchema = z.object({
  number: z
    .string()
    .describe('Original label e.g. "1", "16", "23(i)", "23(ii)", "33(a)". Sub-parts are separate.'),
  title: z.string().nullish(),
  questionText: z.string(),
  maxMarks: z.number().min(0.25).default(1),
  section: z.string().nullish().describe('Section name e.g. "Section A", "Section B"'),
  parentQuestionNumber: z.string().nullish().describe('Parent question number e.g. "23" for "23(i)"'),
  subPart: z.string().nullish().describe('Sub-part label e.g. "i", "ii", "a", "b"'),
  subNumber: z.string().nullish().describe('Display label e.g. "23 i.", "11 a."'),
  isOptional: z.boolean().default(false).describe("True if this is an optional/alternative OR choice"),
  choiceGroup: z.string().nullish().describe('Group ID linking alternative choices e.g. "Q19_OR"'),
});

export const extractQuestionsResultSchema = z.object({
  title: z.string().nullish(),
  subject: z.string().nullish(),
  grade: z.string().nullish(),
  totalPaperMarks: z.number().positive().nullish().describe("Total maximum marks printed on header (e.g. 80, 100, 150)"),
  duration: z.string().nullish().describe('Exam duration e.g. "2 ½ hrs", "3 Hours"'),
  generalInstructions: z.array(z.string()).default([]),
  sections: z.array(sectionInfoSchema).default([]),
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
  id: z.string().default("").describe('Unique id for this answer section e.g. "ans_1", "ans_2"'),
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
  matchedAnswerId: z.string().nullish().describe('Id of the matched extracted answer e.g. "ans_1"'),
  studentAnswer: z.string().default(""),
  regions: z.array(answerRegionSchema).default([]),
  status: z.enum(["correct", "partial", "incorrect", "unanswered", "optional_skipped"]),
  marksObtained: z.number().nonnegative().default(0),
  maxMarks: z.number().min(0.25).default(1),
  aiRemarks: z.string().default(""),
  modelAnswer: z.string().nullish(),
  confidence: z.number().min(0).max(100).nullish(),
  isOptional: z.boolean().default(false),
  choiceGroup: z.string().nullish(),
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

export type SectionInfoResult = z.infer<typeof sectionInfoSchema>;
export type ExtractQuestionsResult = z.infer<typeof extractQuestionsResultSchema>;
export type ExtractAnswersResult = z.infer<typeof extractAnswersResultSchema>;
export type MapAndGradeResult = z.infer<typeof mapAndGradeResultSchema>;
export type ValidateDocumentsResult = z.infer<
  typeof validateDocumentsResultSchema
>;
