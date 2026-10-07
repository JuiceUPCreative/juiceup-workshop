import "server-only";
import { randomCode, randomId } from "./ids";
import { store } from "./store";
import type {
  Feedback,
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
      explanation: q.explanation ?? "",
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
    return {
      id: str(q.id, 40) || randomId(),
      text: str(q.text, 2000),
      answers,
      correctId,
      explanation: str(q.explanation, 4000),
    };
  });
}

export function feedbackFor(session: Session): Feedback {
  const out: Feedback = {};
  for (const q of session.questions) {
    out[q.id] = { correctId: q.correctId, explanation: q.explanation ?? "" };
  }
  return out;
}

export function computeStats(
  session: Session,
  responses: SessionResponse[],
  startedCount: number,
): SessionStats {
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
    // Older data may predate start tracking, so never report fewer starts than submissions.
    startedCount: Math.max(startedCount, responses.length),
    responseCount: responses.length,
    averageScore,
    lastResponseAt: responses.length ? Math.max(...responses.map((r) => r.createdAt)) : null,
    questions,
  };
}

export function demoQuestions(): Question[] {
  const make = (text: string, answers: string[], correctIndex: number, explanation: string): Question => {
    const as = answers.map((t) => ({ id: randomId(), text: t }));
    return { id: randomId(), text, answers: as, correctId: as[correctIndex].id, explanation };
  };
  return [
    make(
      "Kolega opakovaně nedodržuje termíny. Jak zahájíte rozhovor?",
      [
        "Řeknu mu, že je nespolehlivý a že se na něj tým nemůže spolehnout. Očekávám, že se po jasném upozornění zlepší.",
        "Popíšu konkrétní situaci, pozorované chování a jeho dopad na tým. Potom se zeptám na jeho pohled a společně domluvíme další postup.",
        "Přesunu jeho úkoly na někoho jiného a rozhovor odložím. Nechci zbytečně zvyšovat napětí v týmu.",
      ],
      1,
      "Zpětná vazba se opírá o konkrétní situaci, chování a dopad. Otázka na pohled druhého otevírá prostor pro porozumění a dohodu.",
    ),
    make(
      "Zkušená kolegyně dostává úkol, který už několikrát úspěšně zvládla. Jak ji podpoříte?",
      [
        "Domluvím s ní očekávaný výsledek, hranice rozhodování a kontrolní bod. Způsob provedení nechám na ní a nabídnu podporu, pokud ji bude potřebovat.",
        "Sepíšu přesný postup a požádám ji, aby se před každým dalším krokem zastavila pro moje schválení. Tím snížím riziko chyby.",
        "Úkol jí předám bez kontextu a termínu. Protože je zkušená, nepotřebuje ode mě žádné další informace.",
      ],
      0,
      "Delegování spojuje jasný výsledek a dohodnuté mantinely s přiměřenou samostatností. Zkušenost člověka umožňuje méně direktivní vedení.",
    ),
    make(
      "Člen týmu přichází s chybou, která může ovlivnit zákazníka. Co uděláte jako první?",
      [
        "Na nejbližší poradě ho uvedu jako příklad, jak se práce nemá dělat. Ostatní si pak dají větší pozor.",
        "Řeknu mu, ať chybu vyřeší sám a příště přijde až s hotovým řešením. Každý musí nést odpovědnost.",
        "Poděkuji, že chybu včas otevřel. Společně zjistíme dopad a domluvíme okamžité kroky, potom se vrátíme k příčině a prevenci.",
      ],
      2,
      "Včasné sdílení chyby umožňuje omezit její dopad. Bezpečí pro otevřenou komunikaci a odpovědnost za nápravu se vzájemně doplňují.",
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
