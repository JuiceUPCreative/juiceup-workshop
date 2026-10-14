import type { NextRequest } from "next/server";
import { normalizeCode, participantId } from "@/lib/ids";
import { feedbackFor, getSessionByCode, isOpen, toPublic } from "@/lib/sessions";
import { OPEN_ANSWER_MAX } from "@/lib/types";
import { store } from "@/lib/store";

const notFound = () => Response.json({ error: "Workshop nenalezen", code: "not_found" }, { status: 404 });

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
    return Response.json({ error: "Workshop už nepřijímá odpovědi", code: "closed" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { answers?: unknown; texts?: unknown; pid?: unknown } | null;
  const pid =
    typeof body?.pid === "string" && /^[a-f0-9]{32}$/.test(body.pid) ? body.pid : participantId();
  const raw = (body?.answers ?? {}) as Record<string, unknown>;

  // Keep only answers that match the current questions.
  const answers: Record<string, string> = {};
  const texts: Record<string, string> = {};
  const rawTexts = (body?.texts ?? {}) as Record<string, unknown>;
  let missingOther = false;
  for (const q of session.questions) {
    const a = raw[q.id];
    if (typeof a !== "string") continue;
    if (isOpen(q)) {
      const text = a.trim().slice(0, OPEN_ANSWER_MAX);
      if (text) answers[q.id] = text;
    } else {
      const chosen = q.answers.find((x) => x.id === a);
      if (!chosen) continue;
      answers[q.id] = a;
      if (chosen.open) {
        // The "other" option needs the participant's own text.
        const t = typeof rawTexts[q.id] === "string" ? (rawTexts[q.id] as string).trim().slice(0, OPEN_ANSWER_MAX) : "";
        if (t) texts[q.id] = t;
        else missingOther = true;
      }
    }
  }
  const required = toPublic(session).questions;
  if (missingOther || required.some((q) => !answers[q.id])) {
    return Response.json({ error: "Odpovězte prosím na všechny otázky.", code: "incomplete" }, { status: 400 });
  }

  // Idempotent: a retried or repeated submission never adds a second result.
  await store.addResponse(session.id, {
    id: pid,
    createdAt: Date.now(),
    answers,
    ...(Object.keys(texts).length ? { texts } : {}),
  });

  return Response.json({ feedback: feedbackFor(session) });
}
