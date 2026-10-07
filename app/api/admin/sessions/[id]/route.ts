import type { NextRequest } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { sanitizeQuestions } from "@/lib/sessions";
import { store } from "@/lib/store";

type Ctx = RouteContext<"/api/admin/sessions/[id]">;

const notFound = () => Response.json({ error: "Workshop nenalezen" }, { status: 404 });

export async function GET(_req: NextRequest, ctx: Ctx) {
  if (!(await isAdmin())) return unauthorized();
  const { id } = await ctx.params;
  const session = await store.getSession(id);
  if (!session) return notFound();
  return Response.json({ ...session, responseCount: await store.countResponses(id) });
}

/** Partial update: any of { name, intro, open, shuffleAnswers, questions }. */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  if (!(await isAdmin())) return unauthorized();
  const { id } = await ctx.params;
  const session = await store.getSession(id);
  if (!session) return notFound();

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (typeof body.name === "string") session.name = body.name.slice(0, 200);
  if (typeof body.intro === "string") session.intro = body.intro.slice(0, 2000);
  if (typeof body.open === "boolean") session.open = body.open;
  if (typeof body.shuffleAnswers === "boolean") session.shuffleAnswers = body.shuffleAnswers;
  if (body.questions !== undefined) session.questions = sanitizeQuestions(body.questions);
  session.updatedAt = Date.now();

  await store.saveSession(session);
  return Response.json(session);
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  if (!(await isAdmin())) return unauthorized();
  const { id } = await ctx.params;
  await store.deleteSession(id);
  return Response.json({ ok: true });
}
