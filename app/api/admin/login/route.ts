import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, checkPassword, isAdmin, isPasswordConfigured } from "@/lib/auth";

export async function GET() {
  return Response.json({ admin: await isAdmin(), configured: isPasswordConfigured() });
}

export async function POST(req: NextRequest) {
  if (!isPasswordConfigured()) {
    return Response.json(
      { error: "Na serveru není nastavená proměnná ADMIN_PASSWORD." },
      { status: 500 },
    );
  }
  const body = (await req.json().catch(() => null)) as { password?: unknown } | null;
  const token = checkPassword(typeof body?.password === "string" ? body.password : "");
  if (!token) {
    // Small delay to slow down guessing.
    await new Promise((r) => setTimeout(r, 600));
    return Response.json({ error: "Špatné heslo" }, { status: 401 });
  }
  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return Response.json({ ok: true });
}

export async function DELETE() {
  (await cookies()).delete(ADMIN_COOKIE);
  return Response.json({ ok: true });
}
