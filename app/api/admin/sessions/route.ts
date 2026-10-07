import type { NextRequest } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import {
  cloneQuestions,
  demoQuestions,
  generateUniqueCode,
  newSession,
} from "@/lib/sessions";
import { store, storeKind } from "@/lib/store";
import type { Question, SessionSummary } from "@/lib/types";

export async function GET() {
  if (!(await isAdmin())) return unauthorized();
  const sessions = await store.listSessions();
  const summaries: SessionSummary[] = await Promise.all(
    sessions.map(async (s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      open: s.open,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      questionCount: s.questions.length,
      responseCount: await store.countResponses(s.id),
    })),
  );
  summaries.sort((a, b) => b.createdAt - a.createdAt);
  return Response.json({
    sessions: summaries,
    storage: storeKind,
    // A file store on Vercel would silently lose data — surface it in the UI.
    storageWarning: storeKind === "file" && !!process.env.VERCEL,
  });
}

/** Body: { name, copyFrom?: sessionId, demo?: boolean } */
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return unauthorized();
  const body = (await req.json().catch(() => ({}))) as {
    name?: unknown;
    copyFrom?: unknown;
    demo?: unknown;
  };
  const name = (typeof body.name === "string" && body.name.trim()) || "Nový workshop";

  let questions: Question[] = [];
  let intro = "";
  let shuffleAnswers = true;
  if (typeof body.copyFrom === "string") {
    const src = await store.getSession(body.copyFrom);
    if (!src) return Response.json({ error: "Zdrojový workshop nenalezen" }, { status: 404 });
    questions = cloneQuestions(src.questions);
    intro = src.intro;
    shuffleAnswers = src.shuffleAnswers;
  } else if (body.demo) {
    questions = demoQuestions();
  }

  const session = { ...newSession(await generateUniqueCode(), name.slice(0, 200), questions), intro, shuffleAnswers };
  await store.saveSession(session);
  return Response.json(session, { status: 201 });
}
