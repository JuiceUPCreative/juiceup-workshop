"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type Lang, LANGS } from "@/lib/i18n";
import type { Session, SessionSummary } from "@/lib/types";
import { api, formatDate, plural } from "./api";
import { useAuthError } from "./AdminGate";

type ListResponse = { sessions: SessionSummary[]; storage: "redis" | "file"; storageWarning: boolean };

export function Dashboard() {
  const router = useRouter();
  const onError = useAuthError();
  const [data, setData] = useState<ListResponse | null>(null);

  const load = useCallback(() => {
    api<ListResponse>("/api/admin/sessions").then(setData).catch(onError);
  }, [onError]);
  useEffect(load, [load]);

  return (
    <div className="flex flex-col gap-8 py-10 sm:py-14">
      <h1 className="anim-rise font-display text-4xl font-extrabold">Workshopy</h1>

      {data?.storageWarning && (
        <p className="note">
          Chybí databáze D1 (binding DB), odpovědi se neukládají. Viz README.
        </p>
      )}

      {data ? (
        <LaunchForm sessions={data.sessions} onCreated={(s) => router.push(`/admin/${s.id}`)} onError={onError} />
      ) : (
        <div className="card skeleton h-28" />
      )}

      {!data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card skeleton h-40" />
          ))}
        </div>
      ) : data.sessions.length === 0 ? (
        <p className="text-muted">Zatím žádný workshop.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.sessions.map((s, i) => (
            <Link
              key={s.id}
              href={`/admin/${s.id}`}
              className="card anim-rise group flex flex-col gap-4 p-5 transition-all duration-200 hover:-translate-y-1 hover:border-mint/60 hover:bg-surface-2"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="leading-snug font-bold">{s.name}</h3>
                <StatusBadge open={s.open} />
              </div>
              <p className="text-xs text-muted">
                {formatDate(s.createdAt)} · {s.questionCount} {plural(s.questionCount, "otázka", "otázky", "otázek")}
              </p>
              <div className="mt-auto flex items-end justify-between gap-3 border-t border-line pt-4">
                <span className="flex items-center gap-2 font-mono text-xs tracking-[0.2em] text-muted">
                  {s.code}
                  <LangBadge lang={s.language} />
                </span>
                <span className="text-right text-xs text-muted">
                  <span className="font-display mr-1 text-2xl font-extrabold text-mint tabular-nums">
                    {s.responseCount}
                  </span>
                  odesláno
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function StatusBadge({ open }: { open: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
        open ? "bg-mint/10 text-mint" : "bg-pink/10 text-pink"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${open ? "animate-pulse bg-mint" : "bg-pink"}`} />
      {open ? "Otevřený" : "Uzavřený"}
    </span>
  );
}

function LaunchForm({
  sessions,
  onCreated,
  onError,
}: {
  sessions: SessionSummary[];
  onCreated: (s: Session) => void;
  onError: (e: unknown) => void;
}) {
  const [name, setName] = useState("");
  const [source, setSource] = useState<string>(sessions.length ? `copy:${sessions[0].id}` : "demo");
  const [language, setLanguage] = useState<Lang>(sessions[0]?.language ?? "cs");
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="card anim-rise grid gap-4 p-5 [animation-delay:80ms] sm:p-7 lg:grid-cols-[1fr_1fr_10rem_auto] lg:items-end"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const body: Record<string, unknown> = { name, language };
          if (source === "demo") body.demo = true;
          else if (source.startsWith("copy:")) body.copyFrom = source.slice(5);
          onCreated(await api<Session>("/api/admin/sessions", { method: "POST", json: body }));
        } catch (err) {
          onError(err);
          alert((err as Error).message);
          setBusy(false);
        }
      }}
    >
      <div>
        <label className="label" htmlFor="src">
          Otázky
        </label>
        <select
          id="src"
          className="input"
          value={source}
          onChange={(e) => {
            setSource(e.target.value);
            // A copied workshop keeps its language by default.
            const src = sessions.find((s) => `copy:${s.id}` === e.target.value);
            if (src) setLanguage(src.language);
          }}
        >
          {sessions.length > 0 && (
            <optgroup label="Kopie z workshopu">
              {sessions.map((s) => (
                <option key={s.id} value={`copy:${s.id}`}>
                  {s.name} ({s.questionCount})
                </option>
              ))}
            </optgroup>
          )}
          <option value="demo">Ukázkové otázky</option>
          <option value="empty">Prázdný workshop</option>
        </select>
      </div>
      <div>
        <label className="label" htmlFor="name">
          Název
        </label>
        <input
          id="name"
          className="input"
          placeholder="Leadership · tým Praha · 7. 10."
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={150}
        />
      </div>
      <div>
        <label className="label" htmlFor="lang">
          Jazyk pro účastníky
        </label>
        <select id="lang" className="input" value={language} onChange={(e) => setLanguage(e.target.value as Lang)}>
          {LANGS.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      </div>
      <button className="btn" disabled={busy}>
        {busy ? "…" : "Vytvořit workshop"}
      </button>
    </form>
  );
}

export function LangBadge({ lang }: { lang: Lang }) {
  return (
    <span className="rounded border border-line-strong px-1.5 py-0.5 font-sans text-[10px] font-bold tracking-normal text-muted">
      {lang === "en" ? "EN" : "CZ"}
    </span>
  );
}
