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
   - "parentQuestionNumber": Parent number (e.g. "22" for "22(i)").
   - "subPart": Sub-part letter/numeral (e.g. "i", "ii", "a", "b").
   - "subNumber": Clean display label (e.g. "22 i.", "11 a.").
   - "section": The section it belongs to (e.g. "Section A", "Section B").
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

export const EXTRACT_PAGE_ANSWERS_PROMPT = `You are an expert handwriting transcription and spatial bounding box detector.
For this single answer sheet page image (Page {{PAGE_NUMBER}}):
1. Detect EVERY distinct handwritten answer, solution, or label written on this page.
2. For each answer section:
   - "label": Visible label written by student (e.g. "Q.1", "Ans 1", "Q.16", "Q.17", "Q.24(i)", "Q.33(ii)", "Section A")
   - "transcription": Full text transcription of the handwriting
   - "box_2d": [ymin, xmin, ymax, xmax] integers in 0-1000 normalized coordinates covering that exact handwritten section on this page image.
     * ymin: top edge of handwriting (0 = top of image, 1000 = bottom of image)
     * xmin: left edge of handwriting (0 = left margin, 1000 = right margin)
     * ymax: bottom edge of handwriting
     * xmax: right edge of handwriting
   - "page": {{PAGE_NUMBER}}

Return JSON:
{
  "answers": [
    {
      "id": "p{{PAGE_NUMBER}}_ans_1",
      "label": "Q.1",
      "transcription": "...",
      "page": {{PAGE_NUMBER}},
      "box_2d": [69, 40, 97, 264]
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

EXTRACTED HANDWRITTEN ANSWERS FROM ANSWER SHEET (with exact page & box_2d):
${answersJson}

Grading & Spatial Mapping Guidelines:
1. Match each student answer to its target question number using visible labels AND semantic content.
2. When an answer matches:
   - "matchedAnswerId": id of the matched extracted answer (e.g. "p1_ans_1", "p2_ans_3")
   - "regions": copy the EXACT region from that matched answer: [{ "page": P, "box_2d": [ymin, xmin, ymax, xmax] }]
3. For MCQs (Section A): Check if the selected option letter (A/B/C/D) or text matches the correct answer. Full 1 mark if correct, 0 if incorrect.
4. For Descriptive / Multi-mark Questions (Section B, C, D):
   - Award full or partial credit (0 up to maxMarks) based on correctness, completeness, steps, and key concepts.
   - status: "correct" (full marks), "partial" (partial marks > 0), "incorrect" (0 marks for wrong answer).
5. For Unanswered Questions:
   - If no answer was found anywhere on the sheet for a compulsory question: status: "unanswered", marksObtained: 0, regions: [], aiRemarks: "No answer found on the answer sheet."
6. For Optional / OR Choices:
   - If the student answered one option in an OR choice pair, grade the attempted option.
   - For the unattempted alternative option: status: "optional_skipped", marksObtained: 0, regions: [], aiRemarks: "Alternative choice attempted."
7. Provide concise, constructive "aiRemarks" explaining why marks were awarded or deducted.
8. Return valid JSON matching the schema.

Return valid JSON only:
{
  "studentName": "...",
  "rollNumber": "...",
  "answers": [
    {
      "questionNumber": "1",
      "matchedAnswerId": "p1_ans_1",
      "studentAnswer": "...",
      "regions": [{ "page": 1, "box_2d": [69, 40, 97, 264] }],
      "status": "correct",
      "marksObtained": 1,
      "maxMarks": 1,
      "aiRemarks": "Correct answer.",
      "isOptional": false
    }
  ],
  "unmappedAnswers": [],
  "overallFeedback": "..."
}`;
}
