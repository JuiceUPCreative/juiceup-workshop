import type { Lang } from "./i18n";

export type Answer = {
  id: string;
  text: string;
};

export type Question = {
  id: string;
  text: string;
  answers: Answer[];
  correctId: string | null;
  /** Shown to participants after they submit. */
  explanation: string;
};

export type Session = {
  id: string;
  /** Short public code used in the participant URL (/s/CODE). */
  code: string;
  name: string;
  intro: string;
  /** Language of the participant UI (admin is always Czech). */
  language: Lang;
  questions: Question[];
  open: boolean;
  shuffleAnswers: boolean;
  createdAt: number;
  updatedAt: number;
};

export type SessionResponse = {
  /** Participant id — one response per participant. */
  id: string;
  createdAt: number;
  /** questionId -> answerId */
  answers: Record<string, string>;
};

/** Returned to a participant after submitting: questionId -> recommended answer + explanation. */
export type Feedback = Record<string, { correctId: string | null; explanation: string }>;

/** What participants receive — no correct answers leaked. */
export type PublicSession = {
  code: string;
  name: string;
  language: Lang;
  intro: string;
  open: boolean;
  shuffleAnswers: boolean;
  questions: { id: string; text: string; answers: Answer[] }[];
};

export type SessionSummary = Pick<
  Session,
  "id" | "code" | "name" | "open" | "language" | "createdAt" | "updatedAt"
> & { questionCount: number; responseCount: number; startedCount: number };

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
  startedCount: number;
  responseCount: number;
  averageScore: number | null;
  lastResponseAt: number | null;
  questions: QuestionStats[];
};
