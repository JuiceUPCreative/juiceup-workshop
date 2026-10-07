import "server-only";
import { randomCode, randomId } from "./ids";
import { store } from "./store";
import type {
  PublicSession,
  Question,
  Session,
  SessionResponse,
  SessionStats,
} from "./types";

export async function generateUniqueCode(): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const code = randomCode();
    if (!(await store.getSessionIdByCode(code))) return code;
  }
  return randomCode(7);
}

export async function getSessionByCode(code: string): Promise<Session | null> {
  const id = await store.getSessionIdByCode(code);
  return id ? store.getSession(id) : null;
}

export function toPublic(s: Session): PublicSession {
  return {
    code: s.code,
    name: s.name,
    intro: s.intro,
    open: s.open,
    shuffleAnswers: s.shuffleAnswers,
    questions: s.questions
      .filter((q) => q.text.trim() && q.answers.length > 0)
      .map((q) => ({
        id: q.id,
        text: q.text,
        answers: q.answers.filter((a) => a.text.trim()),
      })),
  };
}

/** Copies questions with fresh ids so the two sessions are fully independent. */
export function cloneQuestions(questions: Question[]): Question[] {
  return questions.map((q) => {
    const idMap = new Map(q.answers.map((a) => [a.id, randomId()]));
    return {
      id: randomId(),
      text: q.text,
      answers: q.answers.map((a) => ({ id: idMap.get(a.id)!, text: a.text })),
      correctId: q.correctId ? (idMap.get(q.correctId) ?? null) : null,
    };
  });
}

/** Validates and normalizes question payloads coming from the admin editor. */
export function sanitizeQuestions(input: unknown): Question[] {
  if (!Array.isArray(input)) return [];
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
  return input.slice(0, 100).map((raw) => {
    const q = (raw ?? {}) as Record<string, unknown>;
    const answers = (Array.isArray(q.answers) ? q.answers : []).slice(0, 12).map((ra) => {
      const a = (ra ?? {}) as Record<string, unknown>;
      return { id: str(a.id, 40) || randomId(), text: str(a.text, 2000) };
    });
    const correctId =
      typeof q.correctId === "string" && answers.some((a) => a.id === q.correctId)
        ? q.correctId
        : null;
    return { id: str(q.id, 40) || randomId(), text: str(q.text, 2000), answers, correctId };
  });
}

export function computeStats(session: Session, responses: SessionResponse[]): SessionStats {
  const questions = session.questions.map((q) => {
    const counts = new Map<string, number>(q.answers.map((a) => [a.id, 0]));
    let answered = 0;
    for (const r of responses) {
      const a = r.answers[q.id];
      if (a && counts.has(a)) {
        counts.set(a, counts.get(a)! + 1);
        answered++;
      }
    }
    const correct = q.correctId ? (counts.get(q.correctId) ?? 0) : 0;
    return {
      id: q.id,
      text: q.text,
      correctId: q.correctId,
      answered,
      correct,
      rate: answered > 0 && q.correctId ? correct / answered : null,
      answers: q.answers.map((a) => ({ id: a.id, text: a.text, count: counts.get(a.id) ?? 0 })),
    };
  });

  const scored = session.questions.filter((q) => q.correctId);
  let averageScore: number | null = null;
  if (responses.length && scored.length) {
    const total = responses.reduce(
      (sum, r) => sum + scored.filter((q) => r.answers[q.id] === q.correctId).length / scored.length,
      0,
    );
    averageScore = total / responses.length;
  }

  return {
    responseCount: responses.length,
    averageScore,
    lastResponseAt: responses.length ? Math.max(...responses.map((r) => r.createdAt)) : null,
    questions,
  };
}

export function demoQuestions(): Question[] {
  const make = (text: string, answers: string[], correctIndex: number): Question => {
    const as = answers.map((t) => ({ id: randomId(), text: t }));
    return { id: randomId(), text, answers: as, correctId: as[correctIndex].id };
  };
  return [
    make(
      "Co nejlépe vystihuje pojem „engagement“ zaměstnanců?",
      [
        "Spokojenost zaměstnanců s platem a benefity, kterou firma pravidelně měří v ročním průzkumu.",
        "Emoční a racionální závazek k firmě, který se projevuje ochotou dávat do práce víc, než je nezbytně nutné.",
        "Počet firemních akcí a teambuildingů, kterých se zaměstnanec za rok zúčastní.",
        "Míra, do jaké zaměstnanec dodržuje interní pravidla a procesy.",
      ],
      1,
    ),
    make(
      "Kdo má podle výzkumů největší vliv na engagement jednotlivce?",
      [
        "Generální ředitel a jeho komunikace směrem k celé firmě.",
        "HR oddělení a nastavení benefitového programu.",
        "Přímý nadřízený a kvalita každodenní spolupráce s ním.",
        "Kolegové z jiných oddělení.",
      ],
      2,
    ),
    make(
      "Co je nejdůležitější udělat po vyhodnocení průzkumu engagementu?",
      [
        "Zveřejnit výsledky jen vedení, aby nedošlo ke zbytečnému neklidu.",
        "Výsledky sdílet s týmy, společně vybrat priority a domluvit konkrétní kroky.",
        "Počkat na další ročník průzkumu a porovnat trend.",
        "Plošně zvýšit benefity všem zaměstnancům.",
      ],
      1,
    ),
  ];
}

export function newSession(
  code: string,
  name: string,
  questions: Question[],
): Session {
  const now = Date.now();
  return {
    id: randomId(),
    code,
    name,
    intro: "",
    questions,
    open: true,
    shuffleAnswers: true,
    createdAt: now,
    updatedAt: now,
  };
}
