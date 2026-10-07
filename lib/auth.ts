import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "jw_admin";

function adminPassword(): string | null {
  const pw = process.env.ADMIN_PASSWORD;
  if (pw) return pw;
  // Convenience for local development only.
  return process.env.NODE_ENV === "production" ? null : "admin";
}

function tokenFor(password: string): string {
  return createHmac("sha256", password).update("juiceup-workshop-admin-v1").digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function isPasswordConfigured(): boolean {
  return adminPassword() !== null;
}

/** Returns the cookie token on success, null on a wrong password. */
export function checkPassword(input: string): string | null {
  const pw = adminPassword();
  if (!pw || !safeEqual(input, pw)) return null;
  return tokenFor(pw);
}

export async function isAdmin(): Promise<boolean> {
  const pw = adminPassword();
  if (!pw) return false;
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  return !!token && safeEqual(token, tokenFor(pw));
}

export function unauthorized() {
  return Response.json({ error: "Nepřihlášen" }, { status: 401 });
}
