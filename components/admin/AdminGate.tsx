"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { Drop, Loader, Logo } from "@/components/Logo";
import { api, UnauthorizedError } from "./api";

const AuthContext = createContext<{ onError: (e: unknown) => void }>({ onError: () => {} });

/** Call with any API error; signs the user out on 401. */
export function useAuthError() {
  return useContext(AuthContext).onError;
}

export function AdminGate({ children, bare = false }: { children: React.ReactNode; bare?: boolean }) {
  const [status, setStatus] = useState<"loading" | "in" | "out">("loading");
  const [configured, setConfigured] = useState(true);

  useEffect(() => {
    api<{ admin: boolean; configured: boolean }>("/api/admin/login")
      .then((r) => {
        setConfigured(r.configured);
        setStatus(r.admin ? "in" : "out");
      })
      .catch(() => setStatus("out"));
  }, []);

  const onError = useCallback((e: unknown) => {
    if (e instanceof UnauthorizedError) setStatus("out");
  }, []);

  if (status === "loading") return <Loader />;
  if (status === "out") return <Login configured={configured} onSuccess={() => setStatus("in")} />;

  if (bare) return <AuthContext.Provider value={{ onError }}>{children}</AuthContext.Provider>;

  return (
    <AuthContext.Provider value={{ onError }}>
      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur">
          <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-5">
            <Link href="/admin" className="flex items-center gap-3">
              <Logo className="h-6 w-auto" />
              <span className="hidden rounded-[2px_2px_8px_2px] bg-ink px-2 py-0.5 text-xs font-semibold text-white sm:inline">
                Lektor
              </span>
            </Link>
            <button
              className="text-sm font-semibold text-muted hover:text-ink"
              onClick={async () => {
                await fetch("/api/admin/login", { method: "DELETE" });
                setStatus("out");
              }}
            >
              Odhlásit
            </button>
          </div>
        </header>
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5">{children}</div>
      </div>
    </AuthContext.Provider>
  );
}

function Login({ configured, onSuccess }: { configured: boolean; onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-5">
      <div className="anim-rise flex items-center gap-3">
        <Logo className="h-7 w-auto" />
        <span className="rounded-[2px_2px_8px_2px] bg-ink px-2 py-0.5 text-xs font-semibold text-white">Lektor</span>
      </div>
      <form
        key={shake}
        className={`ju-corner-lg anim-rise flex flex-col gap-4 bg-surface p-6 shadow-[0_20px_50px_-30px_rgba(31,28,37,0.4)] ${shake ? "anim-squish" : ""}`}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await api("/api/admin/login", { method: "POST", json: { password } });
            onSuccess();
          } catch (err) {
            setError((err as Error).message);
            setShake((n) => n + 1);
          } finally {
            setBusy(false);
          }
        }}
      >
        <h1 className="font-display text-2xl font-bold">Přihlášení lektora</h1>
        {!configured && (
          <p className="rounded-[3px_3px_12px_3px] bg-pink-soft p-3 text-sm">
            Na serveru chybí proměnná <code className="font-semibold">ADMIN_PASSWORD</code>. Nastav ji ve Vercelu
            a nasaď znovu.
          </p>
        )}
        <input
          type="password"
          className="input"
          placeholder="Heslo"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          autoComplete="current-password"
        />
        {error && (
          <p className="flex items-center gap-2 text-sm font-semibold text-pink">
            <Drop className="h-4 w-3" /> {error}
          </p>
        )}
        <button className="btn btn-dark" disabled={busy || !password}>
          {busy ? "Ověřuji…" : "Přihlásit"}
        </button>
      </form>
      <Link href="/" className="text-center text-sm text-muted hover:text-ink">
        ← Zpět na stránku pro účastníky
      </Link>
    </main>
  );
}
