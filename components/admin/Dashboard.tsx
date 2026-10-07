"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Drop } from "@/components/Logo";
import type { Session, SessionSummary } from "@/lib/types";
import { api, formatDate, plural } from "./api";
import { useAuthError } from "./AdminGate";

type ListResponse = { sessions: SessionSummary[]; storage: "redis" | "file"; storageWarning: boolean };

export function Dashboard() {
  const router = useRouter();
  const onError = useAuthError();
  const [data, setData] = useState<ListResponse | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    api<ListResponse>("/api/admin/sessions").then(setData).catch(onError);
  }, [onError]);
  useEffect(load, [load]);

  return (
    <div className="flex flex-col gap-8 py-10">
      <div className="anim-rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold tracking-widest text-mint-strong uppercase">Administrace</p>
          <h1 className="font-display text-4xl font-extrabold">Workshopy</h1>
        </div>
        <button className="btn btn-dark" onClick={() => setCreating((v) => !v)}>
          {creating ? "Zavřít" : "+ Nový workshop"}
        </button>
      </div>

      {data?.storageWarning && (
        <div className="ju-corner bg-pink-soft p-4 text-sm">
          <strong>Pozor:</strong> aplikace běží na Vercelu bez databáze, takže odpovědi se neuloží. Ve Vercelu
          otevři <em>Storage → Upstash for Redis</em> a připoj databázi k projektu (viz README).
        </div>
      )}

      {creating && data && (
        <CreateForm
          sessions={data.sessions}
          onCreated={(s) => router.push(`/admin/${s.id}`)}
          onError={onError}
        />
      )}

      {!data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="ju-corner skeleton h-40" />
          ))}
        </div>
      ) : data.sessions.length === 0 ? (
        !creating && (
          <div className="ju-corner-lg anim-rise flex flex-col items-center gap-4 bg-surface px-6 py-16 text-center">
            <Drop className="anim-drip h-14 w-11 text-mint" />
            <h2 className="font-display text-2xl font-bold">Zatím tu žádný workshop není</h2>
            <p className="max-w-md text-muted">
              Vytvoř první workshop. Můžeš začít s prázdným, nebo s ukázkovými otázkami, které si pak upravíš.
            </p>
            <button className="btn" onClick={() => setCreating(true)}>
              Vytvořit workshop
            </button>
          </div>
        )
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.sessions.map((s, i) => (
            <Link
              key={s.id}
              href={`/admin/${s.id}`}
              className="ju-corner anim-rise group flex flex-col gap-4 bg-surface p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_18px_40px_-24px_rgba(31,28,37,0.45)]"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-display text-lg leading-tight font-bold group-hover:underline">{s.name}</h2>
                <StatusPill open={s.open} />
              </div>
              <div className="mt-auto flex items-end justify-between gap-3">
                <div className="text-sm text-muted">
                  <div>
                    {s.questionCount} {plural(s.questionCount, "otázka", "otázky", "otázek")}
                  </div>
                  <div>{formatDate(s.createdAt)}</div>
                </div>
                <div className="text-right">
                  <div className="font-display text-3xl leading-none font-extrabold tabular-nums">
                    {s.responseCount}
                  </div>
                  <div className="text-xs text-muted">
                    {plural(s.responseCount, "odpověď", "odpovědi", "odpovědí")}
                  </div>
                </div>
              </div>
              <div className="font-mono text-xs tracking-widest text-muted">KÓD {s.code}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function StatusPill({ open }: { open: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
        open ? "bg-mint-soft text-ink" : "bg-line text-muted"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${open ? "animate-pulse bg-mint-strong" : "bg-muted"}`} />
      {open ? "Otevřeno" : "Uzavřeno"}
    </span>
  );
}

function CreateForm({
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
      className="ju-corner-lg anim-rise grid gap-4 bg-surface p-6 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
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
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Název workshopu</span>
        <input
          className="input"
          placeholder="např. Engagement workshop – Praha, říjen"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Otázky</span>
        <select className="input" value={source} onChange={(e) => setSource(e.target.value)}>
          {sessions.length > 0 && (
            <optgroup label="Zkopírovat otázky z workshopu">
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
      </label>
      <button className="btn" disabled={busy}>
        {busy ? "Vytvářím…" : "Vytvořit"}
      </button>
      <p className="text-xs text-muted sm:col-span-3">
        Každý workshop má vlastní QR kód, kopii otázek i výsledky, takže úpravy jednoho workshopu neovlivní ostatní.
      </p>
    </form>
  );
}
