import type { NextRequest } from "next/server";
import { isAdmin, unauthorized } from "@/lib/auth";
import { computeStats } from "@/lib/sessions";
import { store } from "@/lib/store";
import type { Question, SessionResponse } from "@/lib/types";

type Ctx = RouteContext<"/api/admin/sessions/[id]/responses">;

export async function GET(req: NextRequest, ctx: Ctx) {
  if (!(await isAdmin())) return unauthorized();
  const { id } = await ctx.params;
  const session = await store.getSession(id);
  if (!session) return Response.json({ error: "Workshop nenalezen" }, { status: 404 });
  const [responses, started] = await Promise.all([store.listResponses(id), store.countStarted(id)]);

  if (req.nextUrl.searchParams.get("format") === "csv") {
    return new Response(toCsv(session.questions, responses), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="workshop-${session.code}.csv"`,
      },
    });
  }

  return Response.json(computeStats(session, responses, started), {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  if (!(await isAdmin())) return unauthorized();
  const { id } = await ctx.params;
  await store.clearResponses(id);
  return Response.json({ ok: true });
}

function toCsv(questions: Question[], responses: SessionResponse[]): string {
  // Prefix cells that Excel would treat as formulas (CSV injection).
  const esc = (v: string) => `"${(/^[=+\-@\t\r]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`;
  const letter = (i: number) => String.fromCharCode(65 + i);
  const header = ["Čas", ...questions.map((q, i) => `${i + 1}. ${q.text}`), "Správně"];
  const rows = responses.map((r) => {
    let ok = 0;
    const cells = questions.map((q) => {
      const idx = q.answers.findIndex((a) => a.id === r.answers[q.id]);
      if (idx < 0) return "";
      const isOk = q.answers[idx].id === q.correctId;
      if (isOk) ok++;
      return `${letter(idx)}${isOk ? " ✓" : ""}`;
    });
    return [new Date(r.createdAt).toISOString(), ...cells, String(ok)];
  });
  // BOM so Excel opens Czech characters correctly.
  return "﻿" + [header, ...rows].map((r) => r.map(esc).join(";")).join("\r\n");
}
