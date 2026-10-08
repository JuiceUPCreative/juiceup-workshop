"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import confetti from "canvas-confetti";
import { Loader, SiteHeader } from "@/components/Logo";
import { JuiceGlass, JuiceProgress } from "@/components/JuiceProgress";
import type { Feedback, PublicSession } from "@/lib/types";

type Saved = {
  seed: number;
  index: number;
  answers: Record<string, string>;
  started: boolean;
  /** Anonymous participant id from /start — makes submission idempotent. */
  pid?: string;
  feedback?: Feedback;
};

type Q = PublicSession["questions"][number];

const LETTERS = "ABCDEFGHIJKL";

function storageKey(code: string) {
  return `jw:${code}`;
}
function loadSaved(code: string): Saved | null {
  try {
    const raw = localStorage.getItem(storageKey(code));
    if (!raw) return null;
    const s = JSON.parse(raw) as Saved & { result?: Record<string, string | null> };
    // Migrate drafts saved by the first version (correct ids only, no explanations).
    if (s.result && !s.feedback) {
      s.feedback = Object.fromEntries(
        Object.entries(s.result).map(([k, v]) => [k, { correctId: v, explanation: "" }]),
      );
    }
    return s;
  } catch {
    return null;
  }
}
function persist(code: string, s: Saved) {
  try {
    localStorage.setItem(storageKey(code), JSON.stringify(s));
  } catch {}
}

/** Deterministic shuffle so a participant sees the same order after a reload. */
function seededShuffle<T>(items: T[], seed: number): T[] {
  const out = items.slice();
  let s = seed || 1;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) % 4294967296;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function buzz(ms = 12) {
  try {
    navigator.vibrate?.(ms);
  } catch {}
}

function plural(n: number, one: string, few: string, many: string) {
  return n === 1 ? one : n >= 2 && n <= 4 ? few : many;
}

export function Quiz({ params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = use(params);
  const code = rawCode.toUpperCase();

  const [session, setSession] = useState<PublicSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<Saved | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/s/${encodeURIComponent(code)}`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => null))?.error ?? "Chyba načítání");
        return r.json() as Promise<PublicSession>;
      })
      .then((s) => {
        if (cancelled) return;
        setSession(s);
        setState(
          loadSaved(code) ?? {
            seed: Math.floor(Math.random() * 2 ** 31),
            index: 0,
            answers: {},
            started: false,
          },
        );
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [code]);

  const update = useCallback(
    (patch: Partial<Saved>) => {
      setState((prev) => {
        if (!prev) return prev;
        const next = { ...prev, ...patch };
        persist(code, next);
        return next;
      });
    },
    [code],
  );

  const questions = useMemo(() => {
    if (!session || !state) return [];
    return session.questions.map((q) => ({
      ...q,
      answers: session.shuffleAnswers
        ? seededShuffle(q.answers, state.seed + q.id.charCodeAt(0) * 31 + q.id.length)
        : q.answers,
    }));
  }, [session, state?.seed]); // eslint-disable-line react-hooks/exhaustive-deps

  async function start() {
    setBusy(true);
    setActionError(null);
    try {
      const r = await fetch(`/api/s/${encodeURIComponent(code)}/start`, { method: "POST" });
      const data = await r.json().catch(() => null);
      if (!r.ok) throw new Error(data?.error ?? "Nepodařilo se začít");
      update({ started: true, pid: data.pid });
    } catch (e) {
      // Starting offline is fine — the submit creates the participant anyway.
      if ((e as Error).message.includes("nepřijímá")) setActionError((e as Error).message);
      else update({ started: true });
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!state) return;
    setBusy(true);
    setActionError(null);
    try {
      const r = await fetch(`/api/s/${encodeURIComponent(code)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: state.answers, pid: state.pid }),
      });
      const data = await r.json().catch(() => null);
      if (!r.ok) throw new Error(data?.error ?? "Odeslání se nepovedlo");
      update({ feedback: data.feedback });
      buzz(30);
      window.scrollTo({ top: 0 });
    } catch (e) {
      setActionError((e as Error).message === "Failed to fetch" ? "Spojení selhalo. Zkuste to prosím znovu." : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <Shell>
        <Message eyebrow="Chyba" title={error}>
          <p>Zkontrolujte kód nebo naskenujte QR znovu.</p>
          <Link href="/" className="btn mt-4 w-fit">
            Zadat kód ↗
          </Link>
        </Message>
      </Shell>
    );
  }

  if (!session || !state) {
    return (
      <Shell>
        <Loader />
      </Shell>
    );
  }

  if (state.feedback) {
    return (
      <Shell>
        <Results questions={questions} answers={state.answers} feedback={state.feedback} />
      </Shell>
    );
  }

  if (!session.open) {
    return (
      <Shell>
        <Message eyebrow={session.name} title={<span className="text-pink">Workshop je uzavřený.</span>}>
          <p>Odpovědi už nejde odeslat.</p>
        </Message>
      </Shell>
    );
  }

  if (questions.length === 0) {
    return (
      <Shell>
        <Message eyebrow={session.name} title="Zatím tu nejsou otázky.">
          <p>Zkuste to za chvíli znovu.</p>
        </Message>
      </Shell>
    );
  }

  if (!state.started) {
    return (
      <Shell>
        <Intro session={session} count={questions.length} busy={busy} error={actionError} onStart={start} />
      </Shell>
    );
  }

  const index = Math.min(state.index, questions.length - 1);
  const q = questions[index];
  const answeredCount = questions.filter((x) => state.answers[x.id]).length;
  const isLast = index === questions.length - 1;
  const allAnswered = answeredCount === questions.length;
  const missing = questions.length - answeredCount;

  return (
    <Shell>
      <div className="flex flex-col gap-4 pt-2">
        <div className="flex items-center justify-between gap-4">
          <span className="eyebrow truncate">{session.name}</span>
          <span className="shrink-0 text-xs text-muted tabular-nums">
            {answeredCount} / {questions.length} odpovědí
          </span>
        </div>
        <JuiceProgress value={answeredCount / questions.length} />
        <StepDots
          questions={questions}
          answers={state.answers}
          current={index}
          onJump={(i) => update({ index: i })}
        />
      </div>

      <QuestionView
        key={q.id}
        number={index + 1}
        total={questions.length}
        q={q}
        selected={state.answers[q.id]}
        onSelect={(answerId) => {
          const first = !state.answers[q.id];
          update({ answers: { ...state.answers, [q.id]: answerId } });
          buzz();
          // Auto-advance on the first pick — feels snappy; changing an answer stays put.
          if (first && !isLast) setTimeout(() => update({ index: index + 1 }), 650);
        }}
      />

      <div className="sticky bottom-0 -mx-5 mt-auto flex flex-col gap-3 bg-gradient-to-t from-bg via-bg to-bg/0 px-5 pt-8 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:-mx-8 sm:px-8">
        {isLast && !allAnswered && (
          <p className="text-center text-sm text-muted">
            Chybí {missing} {plural(missing, "odpověď", "odpovědi", "odpovědí")}.{" "}
            <button
              className="font-semibold text-mint underline underline-offset-4"
              onClick={() => update({ index: questions.findIndex((x) => !state.answers[x.id]) })}
            >
              Doplnit
            </button>
          </p>
        )}
        {actionError && <p className="text-center text-sm font-semibold text-pink">{actionError}</p>}
        <div className="flex items-center justify-between gap-3">
          <button className="btn btn-secondary" disabled={index === 0} onClick={() => update({ index: index - 1 })}>
            ← Zpět
          </button>
          {isLast ? (
            <button className="btn btn-pink" disabled={!allAnswered || busy} onClick={submit}>
              {busy ? "Odesílám…" : "Odeslat"}
            </button>
          ) : (
            <button className="btn" disabled={!state.answers[q.id]} onClick={() => update({ index: index + 1 })}>
              Další →
            </button>
          )}
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 pt-6 sm:px-8 sm:pt-10">{children}</main>
    </div>
  );
}

function Message({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="anim-rise flex flex-1 flex-col justify-center gap-5 py-10">
      <span className="eyebrow">{eyebrow}</span>
      <h1 className="font-display text-5xl leading-[1.04] font-extrabold sm:text-6xl">{title}</h1>
      <div className="flex max-w-xl flex-col text-lg leading-relaxed text-muted">{children}</div>
    </div>
  );
}

function Intro({
  session,
  count,
  busy,
  error,
  onStart,
}: {
  session: PublicSession;
  count: number;
  busy: boolean;
  error: string | null;
  onStart: () => void;
}) {
  return (
    <div className="anim-rise flex flex-1 flex-col justify-center gap-6 py-8">
      <h1 className="font-display text-4xl leading-[1.05] font-extrabold sm:text-6xl">{session.name}</h1>
      {session.intro && <p className="max-w-xl text-lg leading-relaxed whitespace-pre-line text-muted">{session.intro}</p>}
      <p className="text-muted">
        {count} {plural(count, "otázka", "otázky", "otázek")} · u každé vyberte jednu odpověď
      </p>
      {error && <p className="text-sm font-semibold text-pink">{error}</p>}
      <button className="btn w-fit px-10" onClick={onStart} disabled={busy}>
        {busy ? "…" : "Začít"}
      </button>
    </div>
  );
}

function StepDots({
  questions,
  answers,
  current,
  onJump,
}: {
  questions: Q[];
  answers: Record<string, string>;
  current: number;
  onJump: (i: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Otázky">
      {questions.map((q, i) => {
        const done = !!answers[q.id];
        return (
          <button
            key={q.id}
            role="tab"
            aria-selected={i === current}
            aria-label={`Otázka ${i + 1}${done ? ", zodpovězeno" : ""}`}
            onClick={() => onJump(i)}
            className={`grid h-7 w-7 place-items-center rounded-full text-[11px] font-semibold transition-all duration-200 ${
              done ? "bg-mint text-ink" : "border border-line-strong text-muted hover:border-mint hover:text-paper"
            } ${i === current ? "ring-2 ring-pink ring-offset-[3px] ring-offset-bg" : ""}`}
          >
            {i + 1}
          </button>
        );
      })}
    </div>
  );
}

function QuestionView({
  number,
  total,
  q,
  selected,
  onSelect,
}: {
  number: number;
  total: number;
  q: Q;
  selected?: string;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="flex flex-col gap-6 pt-8 pb-2">
      <div className="anim-rise">
        <span className="eyebrow mb-4">
          Otázka {number} z {total}
        </span>
        <h1 className="font-display text-[1.75rem] leading-tight font-bold whitespace-pre-line sm:text-4xl">{q.text}</h1>
      </div>
      <div className="flex flex-col gap-3" role="radiogroup" aria-label="Vyberte jednu odpověď">
        {q.answers.map((a, i) => (
          <AnswerCard
            key={a.id}
            letter={LETTERS[i]}
            text={a.text}
            selected={selected === a.id}
            delay={60 + i * 60}
            onClick={() => onSelect(a.id)}
          />
        ))}
      </div>
    </section>
  );
}

function AnswerCard({
  letter,
  text,
  selected,
  delay,
  onClick,
}: {
  letter: string;
  text: string;
  selected: boolean;
  delay: number;
  onClick: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <div className="anim-rise" style={{ animationDelay: `${delay}ms` }}>
      <button
        ref={ref}
        role="radio"
        aria-checked={selected}
        onClick={() => {
          // Restart the squish animation on every tap.
          const el = ref.current;
          if (el) {
            el.classList.remove("anim-squish");
            void el.offsetWidth;
            el.classList.add("anim-squish");
          }
          onClick();
        }}
        className={`group relative flex w-full items-start gap-4 overflow-hidden rounded-[20px] p-5 text-left transition-[border-color,background-color,transform,box-shadow] duration-200 sm:p-6 ${
          selected
            ? "border-2 border-mint bg-surface shadow-[0_14px_40px_-22px_rgba(99,232,198,0.8)]"
            : "border border-line-strong bg-surface hover:-translate-y-0.5 hover:border-mint/70 hover:bg-surface-2"
        }`}
      >
        {/* juice fill */}
        <span
          aria-hidden
          className="absolute inset-0 origin-left bg-mint/[0.08]"
          style={{
            transform: selected ? "scaleX(1)" : "scaleX(0)",
            transition: "transform 450ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        />
        <span
          className={`relative grid h-8 w-8 shrink-0 place-items-center rounded-full text-[13px] font-bold transition-colors duration-200 ${
            selected ? "anim-pop bg-mint text-ink" : "border border-dim text-muted group-hover:border-mint"
          }`}
        >
          {selected ? (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
              <path className="check-draw" d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          ) : (
            letter
          )}
        </span>
        <span className="relative text-[15px] leading-relaxed whitespace-pre-line sm:text-base">{text}</span>
      </button>
    </div>
  );
}

function Results({
  questions,
  answers,
  feedback,
}: {
  questions: Q[];
  answers: Record<string, string>;
  feedback: Feedback;
}) {
  const scored = questions.filter((q) => feedback[q.id]?.correctId);
  const right = scored.filter((q) => answers[q.id] === feedback[q.id].correctId).length;
  const ratio = scored.length ? right / scored.length : 1;
  const [fill, setFill] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setFill(ratio), 250);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let c: ReturnType<typeof setTimeout> | undefined;
    if (!reduce) {
      c = setTimeout(
        () =>
          confetti({
            particleCount: 70,
            spread: 80,
            origin: { y: 0.3 },
            colors: ["#63e8c6", "#ff67aa", "#f7f7f2"],
            scalar: 0.9,
          }),
        450,
      );
    }
    return () => {
      clearTimeout(t);
      if (c) clearTimeout(c);
    };
  }, [ratio]);

  return (
    <div className="flex flex-col gap-10 pb-16">
      <section className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-5">
          <div className="orb anim-pop grid h-[88px] w-[88px] place-items-center bg-mint text-ink">
            <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path className="check-draw" d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </div>
          <h1 className="anim-rise font-display text-5xl leading-[1.04] font-extrabold [animation-delay:60ms] sm:text-6xl">
            Odesláno
          </h1>
        </div>
        {scored.length > 0 && (
          <div className="card anim-rise flex items-center gap-4 self-start p-5 [animation-delay:180ms] sm:self-auto">
            <JuiceGlass value={fill} className="h-24 w-auto shrink-0" />
            <p className="max-w-[11rem] text-sm leading-snug text-muted">
              <span className="font-display block text-3xl font-extrabold text-paper tabular-nums">
                {right} z {scored.length}
              </span>
              správně
            </p>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        {questions.map((q, i) => {
          const mine = answers[q.id];
          const fb = feedback[q.id] ?? { correctId: null, explanation: "" };
          const isPoll = !fb.correctId;
          const matches = !isPoll && mine === fb.correctId;
          return (
            <article key={q.id} className="card anim-rise p-5 sm:p-7" style={{ animationDelay: `${250 + i * 70}ms` }}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <span className="eyebrow">Otázka {i + 1}</span>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    isPoll ? "bg-line text-paper" : matches ? "bg-mint/15 text-mint" : "bg-pink/15 text-pink"
                  }`}
                >
                  {isPoll ? "Anketa" : matches ? "Správně" : "Špatně"}
                </span>
              </div>
              <h2 className="mb-4 text-lg leading-snug font-bold whitespace-pre-line">{q.text}</h2>
              <div className="flex flex-col gap-2">
                {q.answers.map((a) => {
                  const isCorrect = a.id === fb.correctId;
                  const isMine = a.id === mine;
                  return (
                    <div
                      key={a.id}
                      className={`flex gap-3 rounded-xl border px-4 py-3 text-[15px] leading-relaxed ${
                        isCorrect
                          ? "border-mint bg-mint/[0.05] text-paper"
                          : isMine && isPoll
                            ? "border-paper/40 bg-surface-2 text-paper"
                            : isMine
                              ? "border-pink bg-pink/[0.05] text-paper"
                              : "border-line text-muted"
                      }`}
                    >
                      <span aria-hidden className={isCorrect ? "text-mint" : isMine && !isPoll ? "text-pink" : ""}>
                        {isCorrect ? "✓" : isMine ? "●" : "○"}
                      </span>
                      <div className="whitespace-pre-line">
                        {a.text}
                        {(isMine || isCorrect) && (
                          <span className="mt-1 flex flex-wrap gap-x-3 text-xs font-bold">
                            {isMine && <span>Vaše volba</span>}
                            {isCorrect && <span className="text-mint">Správná odpověď</span>}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {fb.explanation && (
                <p className="mt-5 leading-relaxed whitespace-pre-line text-muted">{fb.explanation}</p>
              )}
            </article>
          );
        })}
      </section>

    </div>
  );
}
