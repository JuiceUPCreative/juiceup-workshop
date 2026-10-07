import type { NextRequest } from "next/server";
import { normalizeCode, participantId } from "@/lib/ids";
import { getSessionByCode } from "@/lib/sessions";
import { store } from "@/lib/store";

/** Registers an anonymous participant so the lecturer sees how many started. */
export async function POST(_req: NextRequest, ctx: RouteContext<"/api/s/[code]/start">) {
  const { code } = await ctx.params;
  const session = await getSessionByCode(normalizeCode(code));
  if (!session) return Response.json({ error: "Workshop nenalezen" }, { status: 404 });
  if (!session.open) {
    return Response.json({ error: "Workshop už nepřijímá odpovědi" }, { status: 403 });
  }
  const pid = participantId();
  await store.markStarted(session.id, pid);
  return Response.json({ pid });
}
