import type { Difficulty, Domain, QuestionType } from "@/generated/prisma/enums";

export const DOMAINS: Domain[] = [
  "ALGEBRA",
  "ADVANCED_MATH",
  "PROBLEM_SOLVING_DATA_ANALYSIS",
  "GEOMETRY_TRIGONOMETRY",
];

export const DOMAIN_LABEL: Record<Domain, string> = {
  ALGEBRA: "Algebra",
  ADVANCED_MATH: "Advanced Math",
  PROBLEM_SOLVING_DATA_ANALYSIS: "Problem-Solving and Data Analysis",
  GEOMETRY_TRIGONOMETRY: "Geometry and Trigonometry",
};

export const DOMAIN_SHORT: Record<Domain, string> = {
  ALGEBRA: "Algebra",
  ADVANCED_MATH: "Adv. Math",
  PROBLEM_SOLVING_DATA_ANALYSIS: "PSDA",
  GEOMETRY_TRIGONOMETRY: "Geo & Trig",
};

export const DIFFICULTIES: Difficulty[] = ["EASY", "MEDIUM", "HARD"];

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  EASY: "Easy",
  MEDIUM: "Medium",
  HARD: "Hard",
};

export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  MCQ: "Multiple choice",
  SPR: "Student-produced response",
};

/** SAT Math skills as published by College Board, grouped by domain. */
export const SKILLS: { code: string; name: string; domain: Domain }[] = [
  { code: "LIN_EQ_1VAR", name: "Linear equations in one variable", domain: "ALGEBRA" },
  { code: "LIN_FUNC", name: "Linear functions", domain: "ALGEBRA" },
  { code: "LIN_EQ_2VAR", name: "Linear equations in two variables", domain: "ALGEBRA" },
  { code: "LIN_SYSTEMS", name: "Systems of two linear equations in two variables", domain: "ALGEBRA" },
  { code: "LIN_INEQ", name: "Linear inequalities in one or two variables", domain: "ALGEBRA" },

  { code: "NONLIN_FUNC", name: "Nonlinear functions", domain: "ADVANCED_MATH" },
  {
    code: "NONLIN_EQ",
    name: "Nonlinear equations in one variable and systems of equations in two variables",
    domain: "ADVANCED_MATH",
  },
  { code: "EQUIV_EXPR", name: "Equivalent expressions", domain: "ADVANCED_MATH" },

  { code: "RATIOS", name: "Ratios, rates, proportional relationships, and units", domain: "PROBLEM_SOLVING_DATA_ANALYSIS" },
  { code: "PERCENT", name: "Percentages", domain: "PROBLEM_SOLVING_DATA_ANALYSIS" },
  { code: "DATA_1VAR", name: "One-variable data: distributions and measures of center and spread", domain: "PROBLEM_SOLVING_DATA_ANALYSIS" },
  { code: "DATA_2VAR", name: "Two-variable data: models and scatterplots", domain: "PROBLEM_SOLVING_DATA_ANALYSIS" },
  { code: "PROBABILITY", name: "Probability and conditional probability", domain: "PROBLEM_SOLVING_DATA_ANALYSIS" },
  { code: "INFERENCE", name: "Inference from sample statistics and margin of error", domain: "PROBLEM_SOLVING_DATA_ANALYSIS" },
  { code: "STAT_CLAIMS", name: "Evaluating statistical claims: observational studies and experiments", domain: "PROBLEM_SOLVING_DATA_ANALYSIS" },

  { code: "AREA_VOLUME", name: "Area and volume", domain: "GEOMETRY_TRIGONOMETRY" },
  { code: "LINES_ANGLES", name: "Lines, angles, and triangles", domain: "GEOMETRY_TRIGONOMETRY" },
  { code: "RIGHT_TRIG", name: "Right triangles and trigonometry", domain: "GEOMETRY_TRIGONOMETRY" },
  { code: "CIRCLES", name: "Circles", domain: "GEOMETRY_TRIGONOMETRY" },
];

export const MCQ_KEYS = ["A", "B", "C", "D"] as const;
export type ChoiceKey = (typeof MCQ_KEYS)[number];
export type Choice = { key: ChoiceKey; text: string };
