export interface BoundingBox {
  id: string;
  questionId: string;
  page: number;
  x: number; // percentage from left
  y: number; // percentage from top
  width: number; // percentage width
  height: number; // percentage height
  label: string;
  score: number;
  maxScore: number;
  status: "correct" | "partial" | "incorrect";
  feedback: string;
}

export interface RubricStep {
  step: number;
  description: string;
  marks: number;
  awarded: number;
  status: "full" | "partial" | "none";
  note?: string;
}

export interface AnswerRegion {
  page: number;
  box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface QuestionEvaluation {
  id: string;
  number?: string;
  questionNumber: number;
  subNumber?: string; // e.g. "a." or "b"
  title: string;
  questionText: string;
  maxMarks: number;
  marksObtained: number;
  status: "correct" | "partial" | "incorrect" | "unanswered";
  page: number;
  confidence: number;
  modelAnswer?: string;
  studentAnswer?: string;
  studentAnswerTranscription?: string;
  rubric?: RubricStep[];
  aiRemarks: string;
  teacherRemarks?: string;
  regions?: AnswerRegion[];
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface UnmappedAnswer {
  id: string;
  transcription: string;
  regions: AnswerRegion[];
}

export interface ThinkingStep {
  id: string;
  label: string;
  detail: string;
  sources?: string[];
}

export interface GroundingBrief {
  subjectGuess: string;
  researchQueries: string[];
  rubricNotes: string;
  conceptNotes: string;
  thinkingSteps: ThinkingStep[];
  usedGoogleSearch: boolean;
}

export interface EvaluationSession {
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
  grounding?: GroundingBrief;
  questions: QuestionEvaluation[];
  unmappedAnswers?: UnmappedAnswer[];
}

export const SAMPLE_EVALUATION: EvaluationSession = {
  id: "session-veda-biology",
  title: "Class 10 - Biology & Life Sciences Unit Test",
  subject: "Biology & Life Sciences",
  grade: "Class X-B",
  studentName: "Aarav Sharma",
  rollNumber: "CBSE-10-4092",
  date: "Aug 27, 2026",
  totalMarks: 39,
  maxMarks: 45,
  percentage: 86.7,
  gradeBadge: "A (Distinction)",
  totalPages: 4,
  questions: [
    {
      id: "q1",
      questionNumber: 1,
      title: "Circulatory Vessels",
      questionText: "Which blood vessel carries blood away from the heart?",
      maxMarks: 2,
      marksObtained: 2,
      status: "correct",
      page: 1,
      confidence: 0.98,
      aiRemarks: "Correct! Identified artery/aorta as the vessel carrying oxygenated blood away from the heart.",
      boundingBox: { x: 5, y: 5, width: 90, height: 18 }
    },
    {
      id: "q2",
      questionNumber: 2,
      title: "Photosynthesis Organelle",
      questionText: "Which of the following organelles is primarily involved in photosynthesis?",
      maxMarks: 2,
      marksObtained: 2,
      status: "correct",
      page: 1,
      confidence: 0.99,
      aiRemarks: "Excellent work! You correctly identified the chloroplast as the organelle responsible for photosynthesis. Keep it up!",
      boundingBox: { x: 5, y: 25, width: 90, height: 28 }
    },
    {
      id: "q3",
      questionNumber: 3,
      title: "Role of Chloroplasts",
      questionText: "Explain the role of chloroplasts in photosynthesis, naming the main pigments involved and briefly outlining the two major stages of the process.",
      maxMarks: 2,
      marksObtained: 2,
      status: "correct",
      page: 1,
      confidence: 0.95,
      aiRemarks: "Clear explanation of light and dark reactions with chlorophyll pigment identified.",
      boundingBox: { x: 5, y: 55, width: 90, height: 25 }
    },
    {
      id: "q4",
      questionNumber: 4,
      title: "Heart Blood Flow Sequence",
      questionText: "Describe the flow of blood through the human heart starting from the right atrium and ending at the aorta; include the names of valves crossed.",
      maxMarks: 2,
      marksObtained: 0,
      status: "incorrect",
      page: 2,
      confidence: 0.92,
      aiRemarks: "Incomplete description. Missed tricuspid valve transition and pulmonary circulation steps.",
      boundingBox: { x: 5, y: 5, width: 90, height: 20 }
    },
    {
      id: "q5",
      questionNumber: 5,
      title: "Alveolus Diagram",
      questionText: "Draw a labelled diagram of an alveolus showing capillaries and air space (label alveolar sac, capillary, and direction of gas exchange).",
      maxMarks: 2,
      marksObtained: 2,
      status: "correct",
      page: 2,
      confidence: 0.96,
      aiRemarks: "Accurate diagram with diffusion gradients clearly marked.",
      boundingBox: { x: 5, y: 28, width: 90, height: 22 }
    },
    {
      id: "q6",
      questionNumber: 6,
      title: "Digestive System Diagram",
      questionText: "Draw a neat labelled diagram of the human digestive system (stomach, small intestine, large intestine, liver, pancreas) and label the site where most absorption occurs.",
      maxMarks: 5,
      marksObtained: 4,
      status: "partial",
      page: 2,
      confidence: 0.94,
      aiRemarks: "Well-labelled diagram. Deducted 1 mark as villi absorption site in ileum was not fully highlighted.",
      boundingBox: { x: 5, y: 52, width: 90, height: 28 }
    },
    {
      id: "q7",
      questionNumber: 7,
      title: "Nephron Structure",
      questionText: "Draw and label a nephron (Bowman's capsule, glomerulus, proximal tubule, loop of Henle, distal tubule, collecting duct).",
      maxMarks: 5,
      marksObtained: 5,
      status: "correct",
      page: 3,
      confidence: 0.97,
      aiRemarks: "Flawless representation of nephron ultrafiltration and reabsorption anatomy.",
      boundingBox: { x: 5, y: 5, width: 90, height: 25 }
    },
    {
      id: "q8",
      questionNumber: 8,
      title: "Mesophyll Structural Differences",
      questionText: "Explain the structural differences between palisade mesophyll and spongy mesophyll and state how each structure aids its function in the leaf.",
      maxMarks: 5,
      marksObtained: 3,
      status: "partial",
      page: 3,
      confidence: 0.91,
      aiRemarks: "Identified chloroplast density differences, but omitted air cavity gaseous exchange role.",
      boundingBox: { x: 5, y: 32, width: 90, height: 22 }
    },
    {
      id: "q9",
      questionNumber: 9,
      title: "Plant Transpiration",
      questionText: "Describe the process of transpiration in plants in two to three sentences and name two environmental factors that increase its rate.",
      maxMarks: 5,
      marksObtained: 5,
      status: "correct",
      page: 3,
      confidence: 0.98,
      aiRemarks: "Accurately stated stomatal water evaporation and listed temperature & wind velocity factors.",
      boundingBox: { x: 5, y: 56, width: 90, height: 22 }
    },
    {
      id: "q10",
      questionNumber: 10,
      title: "Xylem Vessel Function",
      questionText: "Explain how the structure of xylem vessels facilitates water transport in plants (mention one structural feature and its role).",
      maxMarks: 5,
      marksObtained: 4,
      status: "partial",
      page: 4,
      confidence: 0.93,
      aiRemarks: "Good mention of lignified hollow tubes providing tensile strength against transpirational pull.",
      boundingBox: { x: 5, y: 5, width: 90, height: 20 }
    },
    {
      id: "q11a",
      questionNumber: 11,
      subNumber: "a.",
      title: "Plant Phototropism & Dim Light",
      questionText: "A diagram shows two potted plants — Plant A in bright light with broad green leaves, Plant B kept in dim light with pale, elongated leaves.",
      maxMarks: 2,
      marksObtained: 2,
      status: "correct",
      page: 4,
      confidence: 0.95,
      aiRemarks: "Correctly identified etiolation and chlorophyll breakdown in dim lighting conditions.",
      boundingBox: { x: 5, y: 27, width: 90, height: 20 }
    },
    {
      id: "q11b",
      questionNumber: 11,
      subNumber: "b.",
      title: "Plant Recovery Measure",
      questionText: "Suggest one practical measure to help Plant B recover.",
      maxMarks: 3,
      marksObtained: 1,
      status: "partial",
      page: 4,
      confidence: 0.88,
      aiRemarks: "Recommended gradual sunlight exposure, but missed nutrient soil supplementation.",
      boundingBox: { x: 5, y: 49, width: 90, height: 18 }
    },
    {
      id: "q12",
      questionNumber: 12,
      title: "Respiratory Tidal Volume",
      questionText: "A resting person has tidal volume (air per breath) of 0.5 L and breathes 12 times per minute.",
      maxMarks: 5,
      marksObtained: 4,
      status: "partial",
      page: 4,
      confidence: 0.92,
      aiRemarks: "Correct total minute ventilation equation (6.0 L/min).",
      boundingBox: { x: 5, y: 69, width: 90, height: 15 }
    },
    {
      id: "q13",
      questionNumber: 13,
      title: "Alveolar Ventilation Calculation",
      questionText: "If dead space is 0.15 L per breath, calculate the alveolar ventilation per minute. Show working.",
      maxMarks: 5,
      marksObtained: 4,
      status: "partial",
      page: 4,
      confidence: 0.94,
      aiRemarks: "Calculated (0.5 - 0.15) * 12 = 4.2 L/min with step-by-step working.",
      boundingBox: { x: 5, y: 85, width: 90, height: 14 }
    }
  ]
};
