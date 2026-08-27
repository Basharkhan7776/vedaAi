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
  title: string;
  questionText: string;
  maxMarks: number;
  marksObtained: number;
  status: "correct" | "partial" | "incorrect" | "unanswered";
  page: number;
  confidence: number;
  modelAnswer: string;
  studentAnswer?: string;
  studentAnswerTranscription: string;
  rubric: RubricStep[];
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
  questions: QuestionEvaluation[];
  unmappedAnswers?: UnmappedAnswer[];
}

export const SAMPLE_EVALUATION: EvaluationSession = {
  id: "session-veda-101",
  title: "Class 10 - Mathematics Mid-Term Examination 2026",
  subject: "Mathematics (Standard)",
  grade: "Class X-A",
  studentName: "Aarav Sharma",
  rollNumber: "CBSE-10-4092",
  date: "Aug 26, 2026",
  totalMarks: 23,
  maxMarks: 27,
  percentage: 85.2,
  gradeBadge: "A (Distinction)",
  totalPages: 2,
  questions: [
    {
      id: "q1",
      questionNumber: 1,
      title: "Roots of Quadratic Equation",
      questionText: "Find the roots of the quadratic equation: 2x² - 7x + 3 = 0 using the quadratic formula.",
      maxMarks: 4,
      marksObtained: 4,
      status: "correct",
      page: 1,
      confidence: 98,
      modelAnswer: "Comparing with ax² + bx + c = 0: a=2, b=-7, c=3. Discriminant D = b² - 4ac = 49 - 24 = 25. Roots x = (7 ± √25) / 4 = (7 ± 5) / 4 => x = 3 or x = 1/2.",
      studentAnswerTranscription: "Given equation: 2x² - 7x + 3 = 0\na = 2, b = -7, c = 3\nD = b² - 4ac = (-7)² - 4(2)(3) = 49 - 24 = 25\nx = (-b ± √D) / (2a)\nx = (7 ± √25) / (2 × 2) = (7 ± 5) / 4\n=> x₁ = (7 + 5)/4 = 12/4 = 3\n=> x₂ = (7 - 5)/4 = 2/4 = 1/2\nRoots are x = 3, 1/2.",
      rubric: [
        {
          step: 1,
          description: "Correct identification of a, b, c coefficients",
          marks: 1,
          awarded: 1,
          status: "full",
        },
        {
          step: 2,
          description: "Computation of Discriminant D = 25",
          marks: 1,
          awarded: 1,
          status: "full",
        },
        {
          step: 3,
          description: "Application of quadratic formula and simplification",
          marks: 2,
          awarded: 2,
          status: "full",
        },
      ],
      aiRemarks: "Flawless step-by-step derivation. Both roots x = 3 and x = 1/2 calculated correctly with explicit discriminant calculation.",
      boundingBox: {
        x: 4,
        y: 6,
        width: 92,
        height: 27,
      },
    },
    {
      id: "q2",
      questionNumber: 2,
      title: "Arithmetic Progression (10th Term & Sum)",
      questionText: "If the first term of an A.P. is 5 and common difference is 3, find the 10th term (a₁₀) and sum of first 10 terms (S₁₀).",
      maxMarks: 5,
      marksObtained: 5,
      status: "correct",
      page: 1,
      confidence: 96,
      modelAnswer: "a = 5, d = 3, n = 10. a₁₀ = a + (10 - 1)d = 5 + 9(3) = 32. S₁₀ = (10/2)[2a + 9d] = 5[10 + 27] = 5(37) = 185.",
      studentAnswerTranscription: "Given: a = 5, d = 3, n = 10\na_n = a + (n - 1)d\na₁₀ = 5 + (10 - 1) × 3 = 5 + 27 = 32\n\nS_n = (n/2)[2a + (n - 1)d]\nS₁₀ = (10/2)[2(5) + 9(3)] = 5 × [10 + 27] = 5 × 37 = 185\nAns: 10th term = 32, Sum = 185.",
      rubric: [
        {
          step: 1,
          description: "Stating formula for nth term and computing a₁₀ = 32",
          marks: 2,
          awarded: 2,
          status: "full",
        },
        {
          step: 2,
          description: "Stating formula for sum S_n",
          marks: 1,
          awarded: 1,
          status: "full",
        },
        {
          step: 3,
          description: "Evaluating S₁₀ = 185 with complete substitution",
          marks: 2,
          awarded: 2,
          status: "full",
        },
      ],
      aiRemarks: "Accurate formulas applied. Both the 10th term and total series sum are verified.",
      boundingBox: {
        x: 4,
        y: 36,
        width: 92,
        height: 27,
      },
    },
    {
      id: "q3",
      questionNumber: 3,
      title: "Trigonometric Identity Proof",
      questionText: "Prove that: (sin θ / (1 + cos θ)) + ((1 + cos θ) / sin θ) = 2 cosec θ.",
      maxMarks: 5,
      marksObtained: 3,
      status: "partial",
      page: 1,
      confidence: 91,
      modelAnswer: "LHS = [sin² θ + (1 + cos θ)²] / [sin θ (1 + cos θ)] = [sin² θ + 1 + 2cos θ + cos² θ] / [sin θ(1 + cos θ)] = [2 + 2cos θ] / [sin θ(1 + cos θ)] = 2(1 + cos θ)/[sin θ(1 + cos θ)] = 2/sin θ = 2 cosec θ = RHS.",
      studentAnswerTranscription: "LHS = sin θ / (1 + cos θ) + (1 + cos θ) / sin θ\nTaking LCM:\n= [sin² θ + (1 + cos θ)²] / [sin θ (1 + cos θ)]\n= [sin² θ + 1 + cos² θ + 2cos θ] / [sin θ (1 + cos θ)]\nSince sin² θ + cos² θ = 1:\n= [1 + 1 + 2cos θ] / [sin θ (1 + cos θ)]\n= [2 + 2cos θ] / [sin θ (1 + cos θ)]\n= 2 / sin θ = 2 sec θ (wrote sec instead of cosec in final line)",
      rubric: [
        {
          step: 1,
          description: "LCM and cross multiplication of terms",
          marks: 2,
          awarded: 2,
          status: "full",
        },
        {
          step: 2,
          description: "Identity sin² θ + cos² θ = 1 applied to yield 2(1+cos θ)",
          marks: 2,
          awarded: 2,
          status: "full",
        },
        {
          step: 3,
          description: "Correct reciprocal identity 2/sin θ = 2 cosec θ",
          marks: 1,
          awarded: -1,
          status: "none",
          note: "Minor slip: Wrote 2 sec θ instead of 2 cosec θ on final line (-2 marks for incomplete final statement and wrong reciprocal).",
        },
      ],
      aiRemarks: "Partial credit awarded (3/5). The student executed algebraic simplification and fundamental identity sin²θ + cos²θ = 1 correctly, but mistakenly wrote sec θ instead of cosec θ in the final equality.",
      boundingBox: {
        x: 4,
        y: 65,
        width: 92,
        height: 31,
      },
    },
    {
      id: "q4",
      questionNumber: 4,
      title: "Coordinate Geometry (Section Formula)",
      questionText: "Find the coordinates of point P which divides line segment joining A(-1, 7) and B(4, -3) in ratio 2:3 internally.",
      maxMarks: 4,
      marksObtained: 4,
      status: "correct",
      page: 2,
      confidence: 97,
      modelAnswer: "m₁=2, m₂=3. x = (m₁x₂ + m₂x₁) / (m₁ + m₂) = (2(4) + 3(-1)) / 5 = (8 - 3)/5 = 1. y = (m₁y₂ + m₂y₁) / (m₁ + m₂) = (2(-3) + 3(7)) / 5 = (-6 + 21)/5 = 3. Point P is (1, 3).",
      studentAnswerTranscription: "Let P(x, y) divide line joining A(-1, 7) and B(4, -3) in ratio 2:3.\nFormula: x = (m₁x₂ + m₂x₁)/(m₁ + m₂), y = (m₁y₂ + m₂y₁)/(m₁ + m₂)\nx = [2(4) + 3(-1)] / (2 + 3) = (8 - 3)/5 = 5/5 = 1\ny = [2(-3) + 3(7)] / (2 + 3) = (-6 + 21)/5 = 15/5 = 3\nTherefore coordinates of point P are (1, 3).",
      rubric: [
        {
          step: 1,
          description: "Stating Section Formula correctly",
          marks: 1,
          awarded: 1,
          status: "full",
        },
        {
          step: 2,
          description: "Calculation of x-coordinate (x = 1)",
          marks: 1.5,
          awarded: 1.5,
          status: "full",
        },
        {
          step: 3,
          description: "Calculation of y-coordinate (y = 3)",
          marks: 1.5,
          awarded: 1.5,
          status: "full",
        },
      ],
      aiRemarks: "All steps, coordinates substitution, and final point (1, 3) are completely accurate.",
      boundingBox: {
        x: 4,
        y: 6,
        width: 92,
        height: 28,
      },
    },
    {
      id: "q5",
      questionNumber: 5,
      title: "Surface Area & Volume of Combined Solid",
      questionText: "A solid toy is in the form of a hemisphere surmounted by a right circular cone. If radius of base is 3.5 cm and height of cone is 4 cm, find total surface area of toy (Use π = 22/7).",
      maxMarks: 5,
      marksObtained: 5,
      status: "correct",
      page: 2,
      confidence: 94,
      modelAnswer: "r = 3.5 cm, h = 4 cm. Slant height l = √(r² + h²) = √(12.25 + 16) = √28.25 ≈ 5.315 cm. TSA = CSA of Cone + CSA of Hemisphere = πrl + 2πr² = πr(l + 2r) = (22/7) × 3.5 × (5.315 + 7) = 11 × 12.315 = 135.46 cm².",
      studentAnswerTranscription: "Radius r = 3.5 cm = 7/2 cm, Height of cone h = 4 cm\nSlant height l = √(r² + h²) = √((7/2)² + 4²) = √(49/4 + 16) = √(113/4) = √113 / 2 ≈ 5.315 cm\nTotal Surface Area = CSA of Cone + CSA of Hemisphere\nTSA = πrl + 2πr² = πr(l + 2r)\n= (22/7) × (7/2) × (5.315 + 2(3.5))\n= 11 × (5.315 + 7) = 11 × 12.315 = 135.46 cm².",
      rubric: [
        {
          step: 1,
          description: "Calculation of slant height l = 5.315 cm",
          marks: 2,
          awarded: 2,
          status: "full",
        },
        {
          step: 2,
          description: "Correct combined formula: πrl + 2πr²",
          marks: 1.5,
          awarded: 1.5,
          status: "full",
        },
        {
          step: 3,
          description: "Final evaluated area with units cm²",
          marks: 1.5,
          awarded: 1.5,
          status: "full",
        },
      ],
      aiRemarks: "Method is clear and accurate. Calculation of slant height, formula combination and final numerical value with units is correct.",
      boundingBox: {
        x: 4,
        y: 36,
        width: 92,
        height: 29,
      },
    },
    {
      id: "q6",
      questionNumber: 6,
      title: "Probability of Drawing Cards",
      questionText: "A card is drawn from a well-shuffled pack of 52 playing cards. Find the probability of getting: (i) A red face card, (ii) A spade, (iii) Neither a king nor a queen.",
      maxMarks: 4,
      marksObtained: 2,
      status: "partial",
      page: 2,
      confidence: 93,
      modelAnswer: "(i) Total red face cards = 6 (3 hearts + 3 diamonds). P(Red Face) = 6/52 = 3/26.\n(ii) Total spades = 13. P(Spade) = 13/52 = 1/4.\n(iii) Kings (4) + Queens (4) = 8 cards. Favorable = 52 - 8 = 44. P(Neither K nor Q) = 44/52 = 11/13.",
      studentAnswerTranscription: "(i) Red face cards = 6 -> P = 6/52 = 3/26 [Correct]\n(ii) Spades = 13 -> P = 13/52 = 1/4 [Correct]\n(iii) Kings = 4, Queens = 4 -> Total = 8. Student wrote: P = 8/52 = 2/13 (Calculated probability of getting K or Q instead of *neither*).",
      rubric: [
        {
          step: 1,
          description: "Part (i): P(Red Face) = 3/26",
          marks: 1,
          awarded: 1,
          status: "full",
        },
        {
          step: 2,
          description: "Part (ii): P(Spade) = 1/4",
          marks: 1,
          awarded: 1,
          status: "full",
        },
        {
          step: 3,
          description: "Part (iii): Complement P(Neither King nor Queen) = 11/13",
          marks: 2,
          awarded: 0,
          status: "none",
          note: "Found probability of getting King or Queen (8/52) instead of subtracting from 1 (44/52).",
        },
      ],
      aiRemarks: "Parts (i) and (ii) are correct. In part (iii), the student calculated P(King or Queen) instead of P(Neither King nor Queen).",
      boundingBox: {
        x: 4,
        y: 67,
        width: 92,
        height: 29,
      },
      regions: [{ page: 2, box: { x: 4, y: 67, width: 92, height: 29 } }],
    },
  ],
  unmappedAnswers: [],
};

export const RECENT_EVALUATIONS = [
  {
    id: "session-veda-101",
    title: "Class 10 - Mathematics Mid-Term",
    date: "Just now",
    score: "85.2%",
    status: "Completed",
    student: "Aarav Sharma",
  },
  {
    id: "session-veda-102",
    title: "Physics Term 1 - Mechanics & Optics",
    date: "2 hours ago",
    score: "92.0%",
    status: "Completed",
    student: "Priya Patel",
  },
  {
    id: "session-veda-103",
    title: "Chemistry Unit Test - Organic Carbon",
    date: "Yesterday",
    score: "78.5%",
    status: "Completed",
    student: "Rohan Verma",
  },
  {
    id: "session-veda-104",
    title: "Biology Formative Assessment 2",
    date: "3 days ago",
    score: "88.0%",
    status: "Completed",
    student: "Sneha Reddy",
  },
];
