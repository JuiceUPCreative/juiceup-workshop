"use client";

import { useEffect, useState } from "react";
import type { QuestionStats, SessionStats } from "@/lib/types";
import { api, formatDate } from "./api";
import { useAuthError } from "./AdminGate";

const LETTERS = "ABCDEFGHIJKL";

function tone(rate: number | null) {
  if (rate === null) return { bar: "bg-line-strong", text: "text-muted" };
  if (rate >= 0.7) return { bar: "bg-mint", text: "text-mint" };
  if (rate >= 0.4) return { bar: "bg-paper/70", text: "text-paper" };
  return { bar: "bg-pink", text: "text-pink" };
}
const pct = (r: number | null) => (r === null ? "—" : `${Math.round(r * 100)} %`);

export function Results({ sessionId, onCountChange }: { sessionId: string; onCountChange: (n: number) => void }) {
  const onError = useAuthError();
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [sort, setSort] = useState<"order" | "worst" | "best">("order");
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () =>
      api<SessionStats>(`/api/admin/sessions/${sessionId}/responses`)
        .then((s) => {
          if (!alive) return;
          setStats(s);
          setOffline(false);
          onCountChange(s.responseCount);
        })
        .catch((e) => {
          onError(e);
          if (alive) setOffline(true);
        });
    load();
    const iv = setInterval(() => document.visibilityState === "visible" && load(), 5000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [sessionId, onError, onCountChange]);

  if (!stats) {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="card skeleton h-28" />
        ))}
      </div>
    );
  }

  const scored = stats.questions.filter((q) => q.rate !== null);
  const hardest = scored.length > 1 ? scored.reduce((a, b) => (b.rate! < a.rate! ? b : a)) : null;
  const indexOf = new Map(stats.questions.map((q, i) => [q.id, i]));
  const ordered = [...stats.questions].sort((a, b) => {
    if (sort === "order") return 0;
    const ra = a.rate ?? (sort === "worst" ? 2 : -1);
    const rb = b.rate ?? (sort === "worst" ? 2 : -1);
    return sort === "worst" ? ra - rb : rb - ra;
  });
  const allOpen = stats.questions.length > 0 && stats.questions.every((q) => openIds.has(q.id));
  const toggle = (id: string) =>
    setOpenIds((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-3 gap-3">
        <Metric value={String(stats.startedCount)} label="Začalo" />
        <Metric value={String(stats.responseCount)} label="Odeslalo" />
        <Metric value={pct(stats.averageScore)} label="Úspěšnost" />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-bold">Otázky</h2>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="input w-auto! py-2! text-sm"
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              aria-label="Pořadí výsledků"
            >
              <option value="order">Pořadí</option>
              <option value="worst">Nejnižší úspěšnost</option>
              <option value="best">Nejvyšší úspěšnost</option>
            </select>
            <a className="btn btn-secondary btn-sm" href={`/api/admin/sessions/${sessionId}/responses?format=csv`}>
              CSV
            </a>
          </div>
        </div>
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
          {offline ? (
            <span className="text-pink">Offline</span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-mint">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-mint" /> živě
            </span>
          )}
          {stats.lastResponseAt && <span>· poslední {formatDate(stats.lastResponseAt)}</span>}
        </p>
      </div>

      {stats.responseCount === 0 && (
        <p className="text-sm text-muted">Zatím žádné odpovědi.</p>
      )}

      {stats.questions.length > 0 && (
        <div className="flex flex-col gap-3">
          <button
            className="self-end text-xs font-semibold text-muted hover:text-paper"
            onClick={() => setOpenIds(allOpen ? new Set() : new Set(stats.questions.map((q) => q.id)))}
          >
            {allOpen ? "Sbalit vše" : "Rozbalit vše"}
          </button>
          {ordered.map((q) => (
            <QuestionCard
              key={q.id}
              q={q}
              number={indexOf.get(q.id)! + 1}
              open={openIds.has(q.id)}
              onToggle={() => toggle(q.id)}
              isHardest={hardest?.id === q.id}
            />
          ))}
        </div>
      )}

      <div className="flex justify-end">
        <button
          className="text-xs font-semibold text-muted hover:text-pink disabled:opacity-40"
          disabled={stats.responseCount === 0 && stats.startedCount === 0}
          onClick={async () => {
            if (!confirm(`Smazat všechny odpovědi (${stats.responseCount})? Tohle nejde vrátit.`)) return;
            try {
              await api(`/api/admin/sessions/${sessionId}/responses`, { method: "DELETE" });
              setStats(await api<SessionStats>(`/api/admin/sessions/${sessionId}/responses`));
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
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-[20px] border border-line bg-surface p-4 sm:p-5">
      <strong key={value} className="anim-pop font-display text-2xl font-extrabold text-mint tabular-nums sm:text-4xl">
        {value}
      </strong>
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}

function QuestionCard({
  q,
  number,
  open,
  onToggle,
  isHardest,
}: {
  q: QuestionStats;
  number: number;
  open: boolean;
  onToggle: () => void;
  isHardest: boolean;
}) {
  const t = tone(q.rate);
  return (
    <article className="card p-5 sm:p-6">
      <button className="group flex w-full flex-col gap-3 text-left" onClick={onToggle} aria-expanded={open}>
        <div className="flex items-center justify-between gap-3">
          <span className="eyebrow">
            Otázka {number}
            {isHardest && <span className="ml-2 text-pink">· nejhorší</span>}
          </span>
          <strong className={`font-display text-xl font-extrabold tabular-nums ${t.text}`}>{pct(q.rate)}</strong>
        </div>
        <h3 className="text-lg leading-snug font-bold whitespace-pre-line group-hover:text-mint">
          {q.text || <em className="text-muted">bez textu</em>}
        </h3>
        <div className="h-2 overflow-hidden rounded-full bg-track-2">
          <div
            className={`h-full rounded-full ${t.bar}`}
            style={{ width: `${(q.rate ?? 0) * 100}%`, transition: "width 900ms cubic-bezier(0.22, 1, 0.36, 1)" }}
          />
        </div>
        <span className="flex items-center justify-between text-xs text-muted">
          <span>
            {q.correct} / {q.answered} správně
            {!q.correctId && <span className="ml-2 font-semibold text-pink">bez správné odpovědi</span>}
          </span>
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 transition-transform duration-200"
            style={{ transform: open ? "rotate(180deg)" : "none" }}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>

      {open && (
        <div className="anim-rise mt-5 flex flex-col gap-4 border-t border-line pt-5">
          {q.answers.map((a, i) => {
            const correct = a.id === q.correctId;
            const share = q.answered ? a.count / q.answered : 0;
            return (
              <div key={a.id} className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2">
                <div className="leading-relaxed whitespace-pre-line">
                  <span className="mr-2 text-xs text-muted">{LETTERS[i]}</span>
                  {a.text}
                  {correct && <span className="mt-0.5 block text-xs font-semibold text-mint">✓ Správná</span>}
                </div>
                <span className="text-sm font-bold tabular-nums">
                  {a.count} <span className="font-normal text-muted">({Math.round(share * 100)} %)</span>
                </span>
                <div className="col-span-2 h-2 overflow-hidden rounded-full bg-track-2">
                  <div
                    className={`h-full rounded-full ${correct ? "bg-mint" : "bg-pink"}`}
                    style={{ width: `${share * 100}%`, transition: "width 700ms cubic-bezier(0.22,1,0.36,1)" }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}
