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
   - Extract each section if present (e.g., "Section A", "Section B", "Section I", "Section II", "Part A", "Part B", or empty array [] if the paper has no sections).
   - Include: name (exact section name as printed), title (e.g. "Multiple Choice Questions"), questionRange (e.g. "1-15"), marksPerQuestion, totalMarks for the section, isCompulsory (true unless choice), instructions.

3. QUESTIONS & SUB-PARTS:
   - Extract EVERY question in printed order.
   - Treat labelled sub-parts as SEPARATE entries (e.g., "22(i)", "22(ii)", "23(i)", "33(a)").
   - "number": Original label without redundant 'Q.' prefixes (e.g. "1", "16", "22(i)", "23(i)", "33(i)").
   - "parentQuestionNumber": Parent number (e.g. "22" for "22(i)").
   - "subPart": Sub-part letter/numeral (e.g. "i", "ii", "a", "b").
   - "subNumber": Clean display label (e.g. "22 i.", "11 a.").
   - "section": The section it belongs to (e.g. "Section A", "Section I", "Part A", or omit/undefined if no sections).
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

export const EXTRACT_PAGE_ANSWERS_PROMPT = `You are a spatial layout and vision extraction expert for student handwritten exam answer sheets.
Analyze this single exam answer sheet page image (Page {{PAGE_NUMBER}}).

Detect EVERY distinct handwritten answer, solution, diagram, graph, chart, sketch, calculation, and label written on this page.

CRITICAL INSTRUCTIONS FOR DIAGRAMS & GRAPHS:
1. When a student draws a diagram (e.g. Amoeba cell, organism, apparatus, anatomy, circuit), graph (e.g. Distance-Time plot with axes and plotted lines/curves, bar graph), or sketch:
   - YOU MUST create an answer entry for it.
   - The bounding box "box_2d": [ymin, xmin, ymax, xmax] MUST FULLY ENCOMPASS THE ENTIRE DIAGRAM / GRAPH (including all axes, curves, arrows, labels, callout text, and the question number/subpart label).
   - DO NOT crop or bound only the question number text and ignore the drawn diagram/graph!
   - In "transcription", fully transcribe all text, plus provide a descriptive summary of the diagram or graph and all labeled parts (e.g. "[Diagram of Amoeba with labels: Nucleus, Cytoplasm, Cell Membrane, Contractile Vacuole, Food Vacuole, Food Particle]" or "[Distance-Time Graph: Linear line through origin representing uniform motion]").
2. When an answer contains BOTH text and a diagram/graph (e.g. Q15 option + graph, Q22 graphs, Q23 Amoeba diagram + functions):
   - The bounding box MUST cover BOTH the text/label AND the adjacent/underlying diagram or graph!
3. Format of "box_2d": [ymin, xmin, ymax, xmax] in 0-1000 normalized coordinates:
   - ymin: Topmost boundary of the answer (text OR diagram)
   - xmin: Leftmost boundary of the answer (text OR diagram)
   - ymax: Bottommost boundary of the answer (text OR diagram)
   - xmax: Rightmost boundary of the answer (text OR diagram)

Return JSON:
{
  "answers": [
    {
      "id": "p{{PAGE_NUMBER}}_ans_1",
      "label": "Q.23 (i)",
      "transcription": "...",
      "page": {{PAGE_NUMBER}},
      "box_2d": [691, 10, 991, 805]
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

EXTRACTED HANDWRITTEN ANSWERS & DIAGRAMS FROM ANSWER SHEET (with exact page & box_2d):
${answersJson}

Grading & Spatial Mapping Guidelines:
1. Match each student answer to its target question number using visible labels, diagrams/graphs, AND semantic content.
2. When an answer matches:
   - "matchedAnswerId": id of the matched extracted answer (e.g. "p1_ans_1", "p2_ans_3", "p3_ans_5")
   - "regions": copy the EXACT region from that matched answer: [{ "page": P, "box_2d": [ymin, xmin, ymax, xmax] }]
3. For Questions Requiring Diagrams / Graphs (e.g., Q15 graph, Q22 graphs, Q23 Amoeba diagram, Q34 graphs):
   - Evaluate the correctness of the drawn diagram/graph, its axes, plotted curves/lines, and labeled organelles/components.
   - Award full credit if the diagram/graph is drawn correctly with required labels. Award partial credit if partially correct or missing labels.
4. For MCQs (Section A): Check if the selected option letter (A/B/C/D), text, or graph matches the correct answer. Full 1 mark if correct, 0 if incorrect.
5. For Descriptive / Multi-mark Questions (Section B, C, D):
   - Award full or partial credit (0 up to maxMarks) based on correctness, completeness, steps, and key concepts.
   - status: "correct" (full marks), "partial" (partial marks > 0), "incorrect" (0 marks for wrong answer).
6. For Unanswered Questions:
   - If no answer or diagram was found anywhere on the sheet for a compulsory question: status: "unanswered", marksObtained: 0, regions: [], aiRemarks: "No answer found on the answer sheet."
7. For Optional / OR Choices:
   - If the student answered one option in an OR choice pair, grade the attempted option.
   - For the unattempted alternative option: status: "optional_skipped", marksObtained: 0, regions: [], aiRemarks: "Alternative choice attempted."
8. Provide concise, constructive "aiRemarks" explaining why marks were awarded or deducted.
9. Return valid JSON matching the schema.

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
