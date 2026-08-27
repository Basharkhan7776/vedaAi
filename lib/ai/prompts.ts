export const VALIDATE_DOCUMENTS_PROMPT = `You validate teacher uploads for an exam mapping tool.

You receive:
1) A file labelled QUESTION_PAPER
2) A file labelled ANSWER_SHEET (PDF and/or page image)

Decide if they are usable for: extract printed questions → map handwritten answers.

A valid question paper typically has numbered exam questions, marks, subject headings.
A valid answer sheet typically shows student responses (handwritten or clearly labelled answers), not a blank page / resume / unrelated doc.

Flag issues when:
- Wrong document type (resume, invoice, notes, unrelated PDF)
- Blank / nearly blank / unreadable scan
- Slots swapped (QP in answer slot or vice versa)
- Pair mismatch (answer sheet clearly for a different paper/subject)
- Corrupt or unreadable file content

Return ONLY one JSON object with EXACTLY these top-level keys:
{
  "questionPaper": { "isValidQuestionPaper": true, "confidence": 0-100, "notes": "..." },
  "answerSheet": { "isValidAnswerSheet": true, "confidence": 0-100, "notes": "..." },
  "pairLooksCompatible": true,
  "issues": [],
  "suggestions": []
}

issues items (if any):
{ "file": "questionPaper"|"answerSheet"|"both", "code": "not_question_paper"|"not_answer_sheet"|"blank_or_unreadable"|"wrong_subject_or_mismatch"|"corrupted_or_unreadable"|"other", "message": "...", "suggestions": ["..."] }

Be specific in message + suggestions. If both valid and compatible, issues and suggestions may be empty arrays.`;

export const EXTRACT_QUESTIONS_PROMPT = `You are extracting exam questions from a question paper (PDF or images).

Rules:
1. Extract EVERY question in the printed order.
2. Treat labelled sub-parts as SEPARATE questions (e.g. "11(a)" and "11(b)" are two entries).
3. Preserve the original numbering/label exactly in the "number" field.
4. Include full question text (and any given data needed to answer).
5. Capture max marks when printed; otherwise use 0.
6. Ignore instructions/cover pages that are not questions.
7. Return JSON only matching the schema.`;

export function buildMapAndGradePrompt(
  questionsJson: string,
  groundingNotes?: string,
): string {
  const groundingBlock = groundingNotes
    ? `\n${groundingNotes}\n`
    : "";

  return `You are mapping a student's handwritten answer sheet to exam questions and grading.
${groundingBlock}
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
8. Grade when possible: correct | partial | incorrect | unanswered. Use maxMarks from the question list when present. Prefer the grounded research brief for expected points.
9. Write concise aiRemarks (per question). Optionally overallFeedback.
10. Return JSON only matching the schema. Do not invent boxes for unanswered questions.`;
}
