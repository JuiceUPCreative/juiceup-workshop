"use client";

import { useEffect, useState } from "react";
import { Drop } from "@/components/Logo";
import type { QuestionStats, SessionStats } from "@/lib/types";
import { api, formatDate, plural } from "./api";
import { useAuthError } from "./AdminGate";

const LETTERS = "ABCDEFGHIJKL";

function tone(rate: number | null) {
  if (rate === null) return { bar: "bg-line", text: "text-muted", label: "Bez dat" };
  if (rate >= 0.7) return { bar: "bg-mint", text: "text-mint-strong", label: "Zvládnuto" };
  if (rate >= 0.4) return { bar: "bg-ink/70", text: "text-ink", label: "Napůl" };
  return { bar: "bg-pink", text: "text-pink", label: "Potřebuje pozornost" };
}
const pct = (r: number | null) => (r === null ? "–" : `${Math.round(r * 100)} %`);

export function Results({ sessionId, onCountChange }: { sessionId: string; onCountChange: (n: number) => void }) {
  const onError = useAuthError();
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [sort, setSort] = useState<"order" | "worst" | "best">("order");
  const [openId, setOpenId] = useState<string | null>(null);
  const [live, setLive] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = () =>
      api<SessionStats>(`/api/admin/sessions/${sessionId}/responses`)
        .then((s) => {
          if (!alive) return;
          setStats(s);
          onCountChange(s.responseCount);
        })
        .catch(onError);
    load();
    if (!live) return () => void (alive = false);
    const iv = setInterval(() => document.visibilityState === "visible" && load(), 4000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [sessionId, live, onError, onCountChange]);

  if (!stats) {
    return (
      <div className="grid gap-4">
        <div className="ju-corner skeleton h-28" />
        <div className="ju-corner skeleton h-64" />
      </div>
    );
  }

  const scored = stats.questions.filter((q) => q.rate !== null);
  const hardest = scored.length ? scored.reduce((a, b) => (b.rate! < a.rate! ? b : a)) : null;
  const easiest = scored.length ? scored.reduce((a, b) => (b.rate! > a.rate! ? b : a)) : null;
  const indexOf = new Map(stats.questions.map((q, i) => [q.id, i]));
  const ordered = [...stats.questions].sort((a, b) => {
    if (sort === "order") return 0;
    const ra = a.rate ?? (sort === "worst" ? 2 : -1);
    const rb = b.rate ?? (sort === "worst" ? 2 : -1);
    return sort === "worst" ? ra - rb : rb - ra;
  });

  return (
    <div className="flex flex-col gap-6 pb-16">
      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi
          label={plural(stats.responseCount, "účastník odpověděl", "účastníci odpověděli", "účastníků odpovědělo")}
          value={String(stats.responseCount)}
          sub={stats.lastResponseAt ? `poslední ${formatDate(stats.lastResponseAt)}` : "zatím nikdo"}
          dark
        />
        <Kpi label="průměrná úspěšnost" value={pct(stats.averageScore)} sub="podíl správných odpovědí" />
        <Kpi
          label="nejtěžší otázka"
          value={hardest ? `#${indexOf.get(hardest.id)! + 1}` : "–"}
          sub={hardest ? `${pct(hardest.rate)} správně` : "čeká se na data"}
          accent={!!hardest}
        />
      </div>

      {stats.responseCount === 0 ? (
        <div className="ju-corner-lg flex flex-col items-center gap-3 bg-surface px-6 py-14 text-center">
          <Drop className="anim-drip h-12 w-10 text-mint" />
          <h3 className="font-display text-xl font-bold">Čekáme na první odpovědi</h3>
          <p className="max-w-sm text-muted">
            Výsledky se tu objeví hned, jak účastníci začnou odesílat. Stránka se obnovuje sama.
          </p>
        </div>
      ) : (
        <section className="ju-corner bg-surface p-4 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display text-xl font-bold">Úspěšnost podle otázek</h3>
            <div className="flex rounded-[3px_3px_14px_3px] bg-bg p-1 text-sm font-semibold">
              {(
                [
                  ["order", "Pořadí"],
                  ["worst", "Nejhorší"],
                  ["best", "Nejlepší"],
                ] as const
              ).map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => setSort(k)}
                  className={`rounded-[2px_2px_10px_2px] px-3 py-1.5 transition-colors ${
                    sort === k ? "bg-ink text-white" : "text-muted hover:text-ink"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <ul className="flex flex-col divide-y divide-line">
            {ordered.map((q) => (
              <QuestionRow
                key={q.id}
                q={q}
                number={indexOf.get(q.id)! + 1}
                open={openId === q.id}
                onToggle={() => setOpenId(openId === q.id ? null : q.id)}
                isHardest={hardest?.id === q.id && scored.length > 1}
                isEasiest={easiest?.id === q.id && scored.length > 1}
              />
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} className="accent-mint-strong" />
          Automaticky obnovovat
          {live && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-mint-strong" />}
        </label>
        <div className="flex gap-2">
          <a className="btn btn-ghost btn-sm" href={`/api/admin/sessions/${sessionId}/responses?format=csv`}>
            Export CSV
          </a>
          <button
            className="btn btn-sm bg-pink-soft text-pink hover:bg-pink hover:text-white"
            disabled={stats.responseCount === 0}
            onClick={async () => {
              if (!confirm(`Smazat všech ${stats.responseCount} odpovědí? Tohle nejde vrátit.`)) return;
              try {
                await api(`/api/admin/sessions/${sessionId}/responses`, { method: "DELETE" });
                setStats({ ...stats, responseCount: 0, averageScore: null, lastResponseAt: null, questions: stats.questions.map((q) => ({ ...q, answered: 0, correct: 0, rate: null, answers: q.answers.map((a) => ({ ...a, count: 0 })) })) });
                onCountChange(0);
              } catch (e) {
                onError(e);
              }
            }}
          >
            Smazat odpovědi
          </button>
        </div>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  dark,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  dark?: boolean;
  accent?: boolean;
}) {
  return (
    <div className={`ju-corner flex flex-col gap-1 p-5 ${dark ? "bg-ink text-white" : "bg-surface"}`}>
      <span
        key={value}
        className={`anim-pop font-display text-4xl font-extrabold tabular-nums ${
          dark ? "text-mint" : accent ? "text-pink" : ""
        }`}
      >
        {value}
      </span>
      <span className="font-semibold">{label}</span>
      <span className={`text-sm ${dark ? "text-white/60" : "text-muted"}`}>{sub}</span>
    </div>
  );
}

function QuestionRow({
  q,
  number,
  open,
  onToggle,
  isHardest,
  isEasiest,
}: {
  q: QuestionStats;
  number: number;
  open: boolean;
  onToggle: () => void;
  isHardest: boolean;
  isEasiest: boolean;
}) {
  const t = tone(q.rate);
  const max = Math.max(1, ...q.answers.map((a) => a.count));
  return (
    <li className="py-3">
      <button className="group grid w-full grid-cols-[2rem_1fr_auto] items-center gap-x-3 gap-y-2 text-left" onClick={onToggle}>
        <span className="grid h-8 w-8 place-items-center rounded-[3px_3px_11px_3px] bg-bg font-display text-sm font-bold">
          {number}
        </span>
        <span className="min-w-0">
          <span className="line-clamp-2 font-semibold leading-snug group-hover:underline">
            {q.text || <em className="text-muted">bez textu</em>}
          </span>
          <span className="mt-0.5 flex flex-wrap gap-2 text-xs text-muted">
            <span>
              {q.correct}/{q.answered} správně
            </span>
            {isHardest && <span className="font-semibold text-pink">● nejtěžší</span>}
            {isEasiest && <span className="font-semibold text-mint-strong">● nejlehčí</span>}
            {!q.correctId && <span className="font-semibold text-pink">chybí správná odpověď</span>}
          </span>
        </span>
        <span className={`font-display text-2xl font-extrabold tabular-nums ${t.text}`}>{pct(q.rate)}</span>
        <span className="col-start-2 col-end-4 block h-2.5 overflow-hidden rounded-full bg-bg">
          <span
            className={`block h-full rounded-full ${t.bar}`}
            style={{
              width: `${(q.rate ?? 0) * 100}%`,
              transition: "width 900ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          />
        </span>
      </button>

      {open && (
        <div className="anim-rise mt-4 flex flex-col gap-2 pl-11">
          {q.answers.map((a, i) => {
            const correct = a.id === q.correctId;
            return (
              <div key={a.id} className="grid grid-cols-[1.75rem_1fr_auto] items-start gap-3">
                <span
                  className={`grid h-7 w-7 place-items-center rounded-[3px_3px_10px_3px] text-xs font-bold ${
                    correct ? "bg-mint" : "bg-bg text-muted"
                  }`}
                >
                  {correct ? "✓" : LETTERS[i]}
                </span>
                <div className="min-w-0">
                  <p className={`text-sm leading-snug whitespace-pre-line ${correct ? "font-semibold" : "text-ink/80"}`}>
                    {a.text}
                  </p>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-bg">
                    <div
                      className={`h-full rounded-full ${correct ? "bg-mint" : "bg-pink/70"}`}
                      style={{ width: `${(a.count / max) * 100}%`, transition: "width 700ms cubic-bezier(0.22,1,0.36,1)" }}
                    />
                  </div>
                </div>
                <span className="text-sm font-semibold tabular-nums">
                  {a.count}
                  <span className="ml-1 font-normal text-muted">
                    ({q.answered ? Math.round((a.count / q.answered) * 100) : 0} %)
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </li>
  );
}
