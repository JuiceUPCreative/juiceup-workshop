"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Drop } from "@/components/Logo";
import type { Session, SessionSummary } from "@/lib/types";
import { api, formatDate, plural } from "./api";
import { useAuthError } from "./AdminGate";

type ListResponse = { sessions: SessionSummary[]; storage: "redis" | "file"; storageWarning: boolean };

export function AdminHero({ children }: { children?: React.ReactNode }) {
  return (
    <div className="anim-rise flex flex-wrap items-end justify-between gap-6">
      <div>
        <span className="eyebrow mb-4">Lektorský prostor</span>
        <h1 className="font-display text-4xl leading-[1.05] font-extrabold sm:text-5xl">
          Otázky, které
          <br />
          <span className="text-mint">posouvají dál.</span>
        </h1>
      </div>
      {children}
    </div>
  );
}

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
      <AdminHero />

      {data?.storageWarning && (
        <p className="note">
          <strong>Pozor:</strong> aplikace běží na Vercelu bez databáze, takže odpovědi se neuloží. Ve Vercelu otevřete{" "}
          <em>Storage → Upstash for Redis</em> a připojte databázi k projektu (viz README).
        </p>
      )}

      {data ? (
        <LaunchForm sessions={data.sessions} onCreated={(s) => router.push(`/admin/${s.id}`)} onError={onError} />
      ) : (
        <div className="card skeleton h-28" />
      )}

      <div className="flex items-center justify-between border-b border-line pb-4">
        <h2 className="font-display text-2xl font-bold">Workshopy & výsledky</h2>
        {data && (
          <span className="text-sm text-muted">
            {data.sessions.length} {plural(data.sessions.length, "workshop", "workshopy", "workshopů")}
          </span>
        )}
      </div>

      {!data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card skeleton h-40" />
          ))}
        </div>
      ) : data.sessions.length === 0 ? (
        <div className="anim-rise flex flex-col items-start gap-3 py-6 leading-relaxed text-muted">
          <Drop className="anim-drip h-10 w-8 text-mint" />
          <p>
            Spusťte první workshop. Každý běh dostane samostatný QR kód i výsledky.
            <br />
            Pro začátek můžete zvolit ukázkové otázky z leadershipu a upravit si je.
          </p>
        </div>
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
                <span className="font-mono text-xs tracking-[0.2em] text-muted">{s.code}</span>
                <span className="text-right text-xs text-muted">
                  <span className="font-display mr-1 text-2xl font-extrabold text-mint tabular-nums">
                    {s.responseCount}
                  </span>
                  dokončeno
                  {s.startedCount > s.responseCount && (
                    <span className="block">{s.startedCount - s.responseCount} rozpracováno</span>
                  )}
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
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="card anim-rise grid gap-4 p-5 [animation-delay:80ms] sm:p-7 lg:grid-cols-[1fr_1fr_auto] lg:items-end"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const body: Record<string, unknown> = { name };
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
        <select id="src" className="input" value={source} onChange={(e) => setSource(e.target.value)}>
          {sessions.length > 0 && (
            <optgroup label="Zkopírovat z workshopu">
              {sessions.map((s) => (
                <option key={s.id} value={`copy:${s.id}`}>
                  {s.name} ({s.questionCount})
                </option>
              ))}
            </optgroup>
          )}
          <option value="demo">Leadership v praxi · ukázková sada</option>
          <option value="empty">Prázdný workshop</option>
        </select>
      </div>
      <div>
        <label className="label" htmlFor="name">
          Název workshopu (např. tým a datum)
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
      <button className="btn" disabled={busy}>
        {busy ? "Spouštíme…" : "Spustit workshop ↗"}
      </button>
      <p className="text-xs leading-relaxed text-muted lg:col-span-3">
        Otázky se do workshopu zkopírují. Pozdější úpravy jednoho workshopu tak nezmění výsledky ostatních.
      </p>
    </form>
  );
}
