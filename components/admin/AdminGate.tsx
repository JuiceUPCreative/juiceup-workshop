"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { Loader, SiteHeader } from "@/components/Logo";
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
        <SiteHeader
          href="/admin"
          right={
            <button
              className="btn btn-secondary btn-sm"
              onClick={async () => {
                await fetch("/api/admin/login", { method: "DELETE" });
                setStatus("out");
              }}
            >
              Odhlásit
            </button>
          }
        />
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 sm:px-8">{children}</div>
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
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex flex-1 flex-col items-center justify-center px-5 py-10">
        <form
          key={shake}
          className={`card anim-rise flex w-full max-w-md flex-col gap-5 p-7 sm:p-9 ${shake ? "anim-squish" : ""}`}
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
          <h1 className="font-display text-3xl font-extrabold">Přihlášení lektora</h1>
          {!configured && (
            <p className="note">
              Chybí <code className="font-semibold">ADMIN_PASSWORD</code> v nastavení serveru.
            </p>
          )}
          <div>
            <label className="label" htmlFor="pw">
              Heslo
            </label>
            <input
              id="pw"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              autoComplete="current-password"
            />
          </div>
          {error && (
            <p className="text-sm font-semibold text-[#ffa7cb]" role="alert">
              {error}
            </p>
          )}
          <button className="btn w-fit px-8" disabled={busy || !password}>
            {busy ? "…" : "Přihlásit"}
          </button>
        </form>
        <Link href="/" className="mt-6 text-sm text-muted hover:text-paper">
          ← Zpět
        </Link>
      </main>
    </div>
  );
}
