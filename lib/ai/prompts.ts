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

export const EXTRACT_QUESTIONS_PROMPT = `You are an expert exam analyzer extracting the complete structure from an exam question paper.

Read the entire question paper from top to bottom, including header, general instructions, sections, and questions.

Extraction Rules:
1. HEADER & OVERALL METADATA:
   - "title": Exam title (e.g. "CBSE Mid-Term Examination")
   - "subject": Subject name (e.g. "Science", "Mathematics")
   - "grade": Class / Grade (e.g. "Class VII", "Class 10")
   - "totalPaperMarks": The TOTAL MAXIMUM MARKS printed at the top of the paper (e.g. 80, 100, 150). This is a critical field!
   - "duration": Duration if printed (e.g. "2 ½ hrs", "3 Hours")
   - "generalInstructions": Array of general instruction strings printed at the start.

2. SECTIONS BREAKDOWN:
   - Extract each section (e.g., "Section A", "Section B", "Section C", "Section D").
   - Include: name, title (e.g. "Multiple Choice Questions"), questionRange (e.g. "1-15"), marksPerQuestion, totalMarks for the section, isCompulsory (true unless choice), instructions.

3. QUESTIONS & SUB-PARTS:
   - Extract EVERY question in printed order.
   - Treat labelled sub-parts as SEPARATE entries (e.g., "22(i)", "22(ii)", "23(i)", "33(a)").
   - "number": Original label without redundant 'Q.' prefixes (e.g. "1", "16", "22(i)", "23(i)", "33(i)").
   - "section": The section it belongs to (e.g. "Section A", "Section B").
   - "parentQuestionNumber": Parent number if it is a sub-part (e.g. "23" for "23(i)").
   - "maxMarks": Proportional marks for this specific sub-part or question:
     * Standalone questions get their full section marks (e.g. Q1-15 in Section A get 1 mark each; Q16-18 in Section B get 2 marks each).
     * Multi-part questions have their section marks divided among sub-parts (e.g., Q22 in 2-mark Section B has (i) and (ii) -> 1 mark each; Q23 in 4-mark Section C has (i) and (ii) -> 2 marks each; Q33 in 5-mark Section D has (i) to (v) -> 1 mark each).
     * The sum of compulsory questions across the paper must equal totalPaperMarks!
   - "isOptional": true if this question is an alternative choice (e.g., under an "OR" option).
   - "choiceGroup": e.g. "Q19_OR" linking mutually exclusive choices.

Return valid JSON only matching the schema:
{
  "title": "...",
  "subject": "...",
  "grade": "...",
  "totalPaperMarks": 80,
  "duration": "2 ½ hrs",
  "generalInstructions": ["All questions are compulsory.", "..."],
  "sections": [
    { "name": "Section A", "title": "Multiple Choice Questions", "questionRange": "1-15", "marksPerQuestion": 1, "totalMarks": 15, "isCompulsory": true, "instructions": "Select one correct option" }
  ],
  "questions": [
    { "number": "1", "section": "Section A", "questionText": "...", "maxMarks": 1, "isOptional": false }
  ]
}`;

export const EXTRACT_ANSWERS_PROMPT = `You transcribe student handwritten solutions from answer sheet page images.

Tasks:
1. Inspect each page image carefully.
2. Extract all distinct answer sections written by the student.
3. If the student wrote a question label (e.g. "Ans 1", "Q.2", "11(a)", "Section B - 3"), capture it in the "label" field.
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

  return `You are evaluating a student's handwritten exam submission against the question paper.

${groundingBlock}

QUESTIONS TO EVALUATE:
${questionsJson}

EXTRACTED HANDWRITTEN ANSWERS FROM ANSWER SHEET:
${answersJson}

Grading Guidelines:
1. Match each student answer to its target question number using visible labels AND semantic content.
2. For MCQs (Section A): Check if the selected option letter (A/B/C/D) or text matches the correct answer. Full 1 mark if correct, 0 if incorrect.
3. For Descriptive / Multi-mark Questions (Section B, C, D):
   - Award full or partial credit (0 up to maxMarks) based on correctness, completeness, steps, and key concepts.
   - status: "correct" (full marks), "partial" (partial marks > 0), "incorrect" (0 marks for wrong answer).
4. For Unanswered Questions:
   - If no answer was found anywhere on the sheet for a compulsory question: status: "unanswered", marksObtained: 0, regions: [], aiRemarks: "No answer found on the answer sheet."
5. For Optional / OR Choices:
   - If the student answered one option in an OR choice pair, grade the attempted option.
   - For the unattempted alternative option: status: "optional_skipped", marksObtained: 0, regions: [], aiRemarks: "Alternative choice attempted."
6. Provide concise, constructive "aiRemarks" explaining why marks were awarded or deducted.
7. Return valid JSON matching the schema.

Return valid JSON only:
{
  "studentName": "...",
  "rollNumber": "...",
  "answers": [
    {
      "questionNumber": "1",
      "studentAnswer": "...",
      "regions": [{ "page": 1, "box_2d": [100, 50, 200, 950] }],
      "status": "correct",
      "marksObtained": 1,
      "maxMarks": 1,
      "aiRemarks": "Correctly identified pulp cavity as containing nerves and blood vessels.",
      "isOptional": false
    }
  ],
  "unmappedAnswers": [],
  "overallFeedback": "..."
}`;
}
