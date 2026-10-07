export type Answer = {
  id: string;
  text: string;
};

export type Question = {
  id: string;
  text: string;
  answers: Answer[];
  correctId: string | null;
};

export type Session = {
  id: string;
  /** Short public code used in the participant URL (/s/CODE). */
  code: string;
  name: string;
  intro: string;
  questions: Question[];
  open: boolean;
  shuffleAnswers: boolean;
  createdAt: number;
  updatedAt: number;
};

export type SessionResponse = {
  id: string;
  createdAt: number;
  /** questionId -> answerId */
  answers: Record<string, string>;
};

/** What participants receive — no correct answers leaked. */
export type PublicSession = {
  code: string;
  name: string;
  intro: string;
  open: boolean;
  shuffleAnswers: boolean;
  questions: { id: string; text: string; answers: Answer[] }[];
};

export type SessionSummary = Pick<
  Session,
  "id" | "code" | "name" | "open" | "createdAt" | "updatedAt"
> & { questionCount: number; responseCount: number };

export type QuestionStats = {
  id: string;
  text: string;
  correctId: string | null;
  answered: number;
  correct: number;
  /** 0..1, or null when nobody answered / no correct answer set */
  rate: number | null;
  answers: { id: string; text: string; count: number }[];
};

export type SessionStats = {
  responseCount: number;
  averageScore: number | null;
  lastResponseAt: number | null;
  questions: QuestionStats[];
};
