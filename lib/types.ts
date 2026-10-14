import type { Lang } from "./i18n";

export type Answer = {
  id: string;
  text: string;
  /** "Other" option: the participant types their own text when choosing it. */
  open?: boolean;
};

/** "choice" = pick one answer (quiz or poll), "open" = free-text answer. */
export type QuestionType = "choice" | "open";

export const OPEN_ANSWER_MAX = 2000;

export type Question = {
  id: string;
  /** Missing on questions created before open questions existed = "choice". */
  type?: QuestionType;
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
  /** Heading after submitting; empty = default "Odesláno" / "Submitted". */
  thankYouTitle?: string;
  /** Shown to participants after they submit, e.g. "Děkujeme za vyplnění". */
  thankYou?: string;
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
  /** questionId -> answerId (choice) or the typed text (open) */
  answers: Record<string, string>;
  /** questionId -> text typed into the chosen "other" option */
  texts?: Record<string, string>;
};

/** Returned to a participant after submitting: questionId -> recommended answer + explanation. */
export type Feedback = Record<string, { correctId: string | null; explanation: string }>;

/** What participants receive — no correct answers leaked. */
export type PublicSession = {
  code: string;
  name: string;
  language: Lang;
  intro: string;
  thankYouTitle: string;
  thankYou: string;
  open: boolean;
  shuffleAnswers: boolean;
  questions: { id: string; type: QuestionType; text: string; answers: Answer[] }[];
};

export type SessionSummary = Pick<
  Session,
  "id" | "code" | "name" | "open" | "language" | "createdAt" | "updatedAt"
> & { questionCount: number; responseCount: number; startedCount: number };

export type QuestionStats = {
  id: string;
  type: QuestionType;
  text: string;
  correctId: string | null;
  answered: number;
  correct: number;
  /** 0..1, or null when nobody answered / no correct answer set */
  rate: number | null;
  answers: { id: string; text: string; count: number; open?: boolean; texts?: string[] }[];
  /** Open questions: the typed answers, newest first. */
  texts: string[];
};

export type SessionStats = {
  startedCount: number;
  responseCount: number;
  averageScore: number | null;
  lastResponseAt: number | null;
  questions: QuestionStats[];
};
