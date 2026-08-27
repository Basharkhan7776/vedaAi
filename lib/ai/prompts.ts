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
2. Treat labelled sub-parts as SEPARATE questions (e.g. "11(a)" and "11(b)" are two distinct entries).
3. Preserve the original numbering/label exactly in the "number" field (e.g. "1", "2", "3(a)", "11(a)").
4. Include full question text (and all options/data needed to answer).
5. Max marks MUST ALWAYS be an integer >= 1 (e.g. 1, 2, 3, 5). If printed on the paper, extract it accurately; if unprinted or 0, default to 1. Never return 0 maxMarks.
6. Ignore cover pages or instructions that are not exam questions.
7. Return valid JSON only matching the schema: {"title":"...","subject":"...","grade":"...","questions":[{"number":"1","questionText":"...","maxMarks":1}]}`;

export const EXTRACT_ANSWERS_PROMPT = `You transcribe student handwritten solutions from answer sheet page images.

Tasks:
1. Inspect each page image carefully.
2. Extract all distinct answer sections written by the student.
3. If the student wrote a question label (e.g. "Ans 1", "Q2", "11(a)", "Section B - 3"), capture it in the "label" field.
4. Transcribe the full handwritten text, mathematical steps, chemical equations, and diagram descriptions into "transcription".
5. Detect the bounding box for that handwritten answer region as "box_2d": [ymin, xmin, ymax, xmax] integers normalized to 0-1000 on THAT page.
6. Extract student name and roll number if written on top of the first sheet.

Return valid JSON only matching the schema:
{
  "studentName": "...",
  "rollNumber": "...",
  "answers": [
    {
      "label": "Ans 1",
      "transcription": "...",
      "page": 1,
      "box_2d": [100, 50, 250, 950]
    }
  ]
}`;

export function buildMapAndGradePrompt(
  questionsJson: string,
  answersJson: string,
  groundingNotes?: string,
): string {
  const groundingBlock = groundingNotes
    ? `\nGROUNDING / RUBRIC GUIDANCE:\n${groundingNotes}\n`
    : "";

  return `You are evaluating a student's handwritten exam submission.

${groundingBlock}

QUESTIONS EXTRACTED FROM QUESTION PAPER:
${questionsJson}

EXTRACTED HANDWRITTEN ANSWERS FROM ANSWER SHEET:
${answersJson}

Tasks:
1. Map each extracted answer to its corresponding question using the student's visible labels (e.g. "Ans 1", "Q3") AND semantic content (answers might be written out of order).
2. If an answer was found for a question:
   - status: "correct" | "partial" | "incorrect"
   - marksObtained: award an integer or fractional mark from 0 up to maxMarks.
   - studentAnswer: full transcribed text.
   - regions: list of region objects with { "page": number, "box_2d": [ymin, xmin, ymax, xmax] }.
   - aiRemarks: concise, helpful teacher feedback explaining what was correct or what was missed.
3. If a question was NOT answered anywhere on the sheet:
   - status: "unanswered"
   - marksObtained: 0
   - regions: []
   - aiRemarks: "No answer found on the answer sheet."
4. If there is handwritten text that does not belong to any question, add it to "unmappedAnswers" with its regions.
5. Provide a brief constructive "overallFeedback" summary.

Return valid JSON only matching the schema:
{
  "studentName": "...",
  "rollNumber": "...",
  "answers": [
    {
      "questionNumber": "1",
      "studentAnswer": "...",
      "regions": [{ "page": 1, "box_2d": [100, 50, 250, 950] }],
      "status": "correct",
      "marksObtained": 2,
      "maxMarks": 2,
      "aiRemarks": "..."
    }
  ],
  "unmappedAnswers": [],
  "overallFeedback": "..."
}`;
}
