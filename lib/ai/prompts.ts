export const EXTRACT_QUESTIONS_PROMPT = `You are extracting exam questions from a question paper (PDF or images).

Rules:
1. Extract EVERY question in the printed order.
2. Treat labelled sub-parts as SEPARATE questions (e.g. "11(a)" and "11(b)" are two entries).
3. Preserve the original numbering/label exactly in the "number" field.
4. Include full question text (and any given data needed to answer).
5. Capture max marks when printed; otherwise use 0.
6. Ignore instructions/cover pages that are not questions.
7. Return JSON only matching the schema.`;

export function buildMapAndGradePrompt(questionsJson: string): string {
  return `You are mapping a student's handwritten answer sheet to exam questions and grading.

Questions (JSON):
${questionsJson}

You are also given ordered page images of the answer sheet (page 1, page 2, ...).

Tasks:
1. For each question, find the student's answer region(s) on the sheet.
2. Transcribe the handwritten answer.
3. Map by semantic content AND visible labels (e.g. "Ans 3", "Q11(a)") — answers may be out of order.
4. If a question has no answer, status="unanswered", empty regions, marksObtained=0.
5. If handwriting exists that matches no question, put it in unmappedAnswers with box_2d.
6. Answers may span multiple pages — return multiple regions.
7. For each region, box_2d MUST be [ymin, xmin, ymax, xmax] integers normalized to 0-1000 on THAT page image.
8. Grade when possible: correct | partial | incorrect | unanswered. Use maxMarks from the question list when present.
9. Write concise aiRemarks (per question). Optionally overallFeedback.
10. Return JSON only matching the schema. Do not invent boxes for unanswered questions.`;
}
