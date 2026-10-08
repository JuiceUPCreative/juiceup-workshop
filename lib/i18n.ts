/**
 * Participant-facing texts. Each workshop has a language; the lecturer admin is always Czech.
 */
export type Lang = "cs" | "en";

export const LANGS: { value: Lang; label: string }[] = [
  { value: "cs", label: "Čeština" },
  { value: "en", label: "English" },
];

/** Error codes returned by the public API, translated on the client. */
export type PublicErrorCode = "not_found" | "closed" | "incomplete";

function czPlural(n: number, one: string, few: string, many: string) {
  return n === 1 ? one : n >= 2 && n <= 4 ? few : many;
}

const cs = {
  loading: "Načítám…",
  loadFailed: "Chyba načítání",
  network: "Spojení selhalo. Zkuste to prosím znovu.",
  submitFailed: "Odeslání se nepovedlo",
  errors: {
    not_found: "Workshop nenalezen",
    closed: "Workshop už nepřijímá odpovědi",
    incomplete: "Odpovězte prosím na všechny otázky.",
  } satisfies Record<PublicErrorCode, string>,
  errorEyebrow: "Chyba",
  checkCode: "Zkontrolujte kód nebo naskenujte QR znovu.",
  enterCode: "Zadat kód ↗",
  closedTitle: "Workshop je uzavřený.",
  closedText: "Odpovědi už nejde odeslat.",
  noQuestions: "Zatím tu nejsou otázky.",
  tryLater: "Zkuste to za chvíli znovu.",
  introCount: (n: number) => `${n} ${czPlural(n, "otázka", "otázky", "otázek")} · u každé vyberte jednu odpověď`,
  start: "Začít",
  answeredOf: (a: number, n: number) => `${a} / ${n} odpovědí`,
  questionsAria: "Otázky",
  stepAria: (i: number, done: boolean) => `Otázka ${i}${done ? ", zodpovězeno" : ""}`,
  questionOf: (i: number, n: number) => `Otázka ${i} z ${n}`,
  pickOne: "Vyberte jednu odpověď",
  missing: (n: number) => `Chybí ${n} ${czPlural(n, "odpověď", "odpovědi", "odpovědí")}.`,
  goToMissing: "Doplnit",
  back: "← Zpět",
  next: "Další →",
  submit: "Odeslat",
  submitting: "Odesílám…",
  submitted: "Odesláno",
  scoreOf: (a: number, n: number) => `${a} z ${n}`,
  correctSuffix: "správně",
  question: (i: number) => `Otázka ${i}`,
  poll: "Anketa",
  right: "Správně",
  wrong: "Špatně",
  yourChoice: "Vaše volba",
  correctAnswer: "Správná odpověď",
  // Projector view
  scan: "Naskenujte",
  qrCode: "QR kód",
  or: "nebo",
  submittedCount: "odesláno",
  collectionClosed: "Sběr je uzavřený.",
};

export type Dict = typeof cs;

const en: Dict = {
  loading: "Loading…",
  loadFailed: "Loading failed",
  network: "Connection failed. Please try again.",
  submitFailed: "Submitting failed",
  errors: {
    not_found: "Workshop not found",
    closed: "This workshop no longer accepts answers",
    incomplete: "Please answer all questions.",
  },
  errorEyebrow: "Error",
  checkCode: "Check the code or scan the QR code again.",
  enterCode: "Enter code ↗",
  closedTitle: "This workshop is closed.",
  closedText: "Answers can no longer be submitted.",
  noQuestions: "No questions yet.",
  tryLater: "Please try again in a moment.",
  introCount: (n) => `${n} ${n === 1 ? "question" : "questions"} · pick one answer for each`,
  start: "Start",
  answeredOf: (a, n) => `${a} / ${n} answered`,
  questionsAria: "Questions",
  stepAria: (i, done) => `Question ${i}${done ? ", answered" : ""}`,
  questionOf: (i, n) => `Question ${i} of ${n}`,
  pickOne: "Choose one answer",
  missing: (n) => `${n} ${n === 1 ? "answer" : "answers"} missing.`,
  goToMissing: "Go there",
  back: "← Back",
  next: "Next →",
  submit: "Submit",
  submitting: "Submitting…",
  submitted: "Submitted",
  scoreOf: (a, n) => `${a} of ${n}`,
  correctSuffix: "correct",
  question: (i) => `Question ${i}`,
  poll: "Poll",
  right: "Correct",
  wrong: "Incorrect",
  yourChoice: "Your choice",
  correctAnswer: "Correct answer",
  scan: "Scan the",
  qrCode: "QR code",
  or: "or",
  submittedCount: "submitted",
  collectionClosed: "Collection is closed.",
};

export const dictionaries: Record<Lang, Dict> = { cs, en };

export function normalizeLang(v: unknown): Lang {
  return v === "en" ? "en" : "cs";
}

/** Before the workshop (and its language) is known, follow the browser. */
export function browserLang(): Lang {
  try {
    return navigator.language.toLowerCase().startsWith("cs") ? "cs" : "en";
  } catch {
    return "cs";
  }
}
