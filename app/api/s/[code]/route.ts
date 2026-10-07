import type { NextRequest } from "next/server";
import { normalizeCode, randomId } from "@/lib/ids";
import { getSessionByCode, toPublic } from "@/lib/sessions";
import { store } from "@/lib/store";

const notFound = () => Response.json({ error: "Workshop nenalezen" }, { status: 404 });

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/s/[code]">) {
  const { code } = await ctx.params;
  const session = await getSessionByCode(normalizeCode(code));
  if (!session) return notFound();
  return Response.json(toPublic(session), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest, ctx: RouteContext<"/api/s/[code]">) {
  const { code } = await ctx.params;
  const session = await getSessionByCode(normalizeCode(code));
  if (!session) return notFound();
  if (!session.open) {
    return Response.json({ error: "Workshop už nepřijímá odpovědi" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { answers?: unknown } | null;
  const raw = (body?.answers ?? {}) as Record<string, unknown>;

  // Keep only answers that match the current questions.
  const answers: Record<string, string> = {};
  for (const q of session.questions) {
    const a = raw[q.id];
    if (typeof a === "string" && q.answers.some((x) => x.id === a)) answers[q.id] = a;
  }
  if (Object.keys(answers).length === 0) {
    return Response.json({ error: "Žádné odpovědi" }, { status: 400 });
  }

  await store.addResponse(session.id, { id: randomId(), createdAt: Date.now(), answers });

  const correct: Record<string, string | null> = {};
  for (const q of session.questions) correct[q.id] = q.correctId;
  return Response.json({ correct });
}
