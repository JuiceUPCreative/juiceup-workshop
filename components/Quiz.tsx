"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import confetti from "canvas-confetti";
import { Drop, Loader, Logo } from "@/components/Logo";
import { JuiceGlass, JuiceProgress } from "@/components/JuiceProgress";
import type { PublicSession } from "@/lib/types";

type Saved = {
  seed: number;
  index: number;
  answers: Record<string, string>;
  started: boolean;
  result?: Record<string, string | null>;
};

const LETTERS = "ABCDEFGHIJKL";

function storageKey(code: string) {
  return `jw:${code}`;
}
function loadSaved(code: string): Saved | null {
  try {
    const raw = localStorage.getItem(storageKey(code));
    return raw ? (JSON.parse(raw) as Saved) : null;
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

export function Quiz({ params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = use(params);
  const code = rawCode.toUpperCase();

  const [session, setSession] = useState<PublicSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<Saved | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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

  async function submit() {
    if (!state) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const r = await fetch(`/api/s/${encodeURIComponent(code)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: state.answers }),
      });
      const data = await r.json().catch(() => null);
      if (!r.ok) throw new Error(data?.error ?? "Odeslání se nepovedlo");
      update({ result: data.correct });
      buzz(30);
    } catch (e) {
      setSubmitError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (error) {
    return (
      <Shell>
        <div className="anim-rise flex flex-1 flex-col items-center justify-center gap-5 text-center">
          <Drop className="h-14 w-11 text-pink" />
          <h1 className="font-display text-3xl font-bold">{error}</h1>
          <p className="max-w-sm text-muted">Zkontroluj prosím kód workshopu nebo naskenuj QR kód znovu.</p>
          <Link href="/" className="btn btn-dark">
            Zadat kód
          </Link>
        </div>
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

  if (state.result) {
    return (
      <Shell>
        <Results questions={questions} answers={state.answers} correct={state.result} />
      </Shell>
    );
  }

  if (!session.open) {
    return (
      <Shell>
        <div className="anim-rise flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <Drop className="h-14 w-11 text-muted" />
          <h1 className="font-display text-3xl font-bold">Workshop je uzavřený</h1>
          <p className="max-w-sm text-muted">Odpovědi teď nepřijímáme. Počkej na pokyn lektora.</p>
        </div>
      </Shell>
    );
  }

  if (questions.length === 0) {
    return (
      <Shell>
        <div className="anim-rise flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <Drop className="h-14 w-11 anim-drip text-mint" />
          <h1 className="font-display text-3xl font-bold">Otázky se ještě chystají</h1>
          <p className="max-w-sm text-muted">Zkus to za chvilku znovu.</p>
        </div>
      </Shell>
    );
  }

  if (!state.started) {
    return (
      <Shell>
        <Intro session={session} count={questions.length} onStart={() => update({ started: true })} />
      </Shell>
    );
  }

  const index = Math.min(state.index, questions.length - 1);
  const q = questions[index];
  const answeredCount = questions.filter((x) => state.answers[x.id]).length;
  const isLast = index === questions.length - 1;
  const allAnswered = answeredCount === questions.length;

  return (
    <Shell
      top={
        <div className="flex items-center gap-3">
          <JuiceProgress value={answeredCount / questions.length} />
          <span className="shrink-0 text-sm font-semibold tabular-nums text-muted">
            {index + 1}/{questions.length}
          </span>
        </div>
      }
    >
      <QuestionView
        key={q.id}
        number={index + 1}
        text={q.text}
        answers={q.answers}
        selected={state.answers[q.id]}
        onSelect={(answerId) => {
          const first = !state.answers[q.id];
          update({ answers: { ...state.answers, [q.id]: answerId } });
          buzz();
          // Auto-advance on the first pick — feels snappy; changing an answer stays put.
          if (first && !isLast) {
            setTimeout(() => update({ index: index + 1 }), 650);
          }
        }}
      />

      <div className="sticky bottom-0 -mx-5 mt-auto flex flex-col gap-3 bg-gradient-to-t from-bg via-bg to-bg/0 px-5 pt-6 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {isLast && !allAnswered && (
          <p className="text-center text-sm text-muted">
            Ještě ti chybí odpovědět na {questions.length - answeredCount}{" "}
            {questions.length - answeredCount === 1 ? "otázku" : "otázky"}.{" "}
            <button
              className="font-semibold text-ink underline"
              onClick={() => update({ index: questions.findIndex((x) => !state.answers[x.id]) })}
            >
              Přejít
            </button>
          </p>
        )}
        {submitError && <p className="text-center text-sm font-semibold text-pink">{submitError}</p>}
        <div className="flex items-center justify-between gap-3">
          <button
            className="btn btn-ghost btn-sm"
            disabled={index === 0}
            onClick={() => update({ index: index - 1 })}
          >
            ← Zpět
          </button>
          {isLast ? (
            <button className="btn btn-pink" disabled={!allAnswered || submitting} onClick={submit}>
              {submitting ? "Odesílám…" : "Odeslat odpovědi"}
            </button>
          ) : (
            <button
              className="btn"
              disabled={!state.answers[q.id]}
              onClick={() => update({ index: index + 1 })}
            >
              Další →
            </button>
          )}
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children, top }: { children: React.ReactNode; top?: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-5">
      <header className="flex flex-col gap-4 pt-5 pb-4">
        <Logo className="h-6 w-auto self-start" />
        {top}
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
    </main>
  );
}

function Intro({
  session,
  count,
  onStart,
}: {
  session: PublicSession;
  count: number;
  onStart: () => void;
}) {
  return (
    <div className="relative flex flex-1 flex-col justify-center gap-6 py-10">
      <Drop className="anim-float pointer-events-none absolute -top-2 right-2 h-24 w-20 text-mint/70" />
      <Drop className="anim-float pointer-events-none absolute bottom-24 -left-3 h-12 w-10 text-pink/70 [animation-delay:-2s]" />
      <p className="anim-rise text-sm font-semibold tracking-widest text-mint-strong uppercase">
        Workshop
      </p>
      <h1 className="anim-rise font-display text-4xl leading-[1.05] font-extrabold sm:text-5xl [animation-delay:60ms]">
        {session.name}
      </h1>
      {session.intro && (
        <p className="anim-rise text-lg whitespace-pre-line text-ink/80 [animation-delay:120ms]">{session.intro}</p>
      )}
      <p className="anim-rise text-muted [animation-delay:160ms]">
        Čeká tě <strong className="text-ink">{count}</strong>{" "}
        {count === 1 ? "otázka" : count < 5 ? "otázky" : "otázek"}. U každé vyber jednu odpověď —
        správné odpovědi uvidíš až na konci.
      </p>
      <div className="anim-rise [animation-delay:220ms]">
        <button className="btn px-10 py-4 text-lg" onClick={onStart}>
          Jdeme na to
        </button>
      </div>
    </div>
  );
}

function QuestionView({
  number,
  text,
  answers,
  selected,
  onSelect,
}: {
  number: number;
  text: string;
  answers: { id: string; text: string }[];
  selected?: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-6 pt-4 pb-2">
      <div className="anim-rise">
        <p className="mb-2 text-sm font-semibold text-mint-strong">Otázka {number}</p>
        <h2 className="font-display text-2xl leading-tight font-bold whitespace-pre-line sm:text-3xl">
          {text}
        </h2>
      </div>
      <div className="flex flex-col gap-3" role="radiogroup">
        {answers.map((a, i) => (
          <AnswerCard
            key={a.id}
            letter={LETTERS[i]}
            text={a.text}
            selected={selected === a.id}
            delay={80 + i * 60}
            onClick={() => onSelect(a.id)}
          />
        ))}
      </div>
    </div>
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
        className={`ju-corner group relative flex w-full items-start gap-4 overflow-hidden border-2 bg-surface p-4 text-left transition-[border-color,box-shadow] duration-200 sm:p-5 ${
          selected
            ? "border-ink shadow-[0_10px_30px_-14px_rgba(47,199,159,0.9)]"
            : "border-transparent shadow-[0_2px_0_rgba(31,28,37,0.04)] hover:border-line"
        }`}
      >
        {/* juice fill */}
        <span
          aria-hidden
          className="absolute inset-0 origin-left bg-mint-soft"
          style={{
            transform: selected ? "scaleX(1)" : "scaleX(0)",
            transition: "transform 450ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        />
        <span
          className={`relative grid h-9 w-9 shrink-0 place-items-center rounded-[3px_3px_12px_3px] font-display text-base font-bold transition-colors duration-200 ${
            selected ? "bg-mint text-ink" : "bg-bg text-ink/70 group-hover:bg-mint-soft"
          }`}
        >
          {selected ? (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
              <path className="check-draw" d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          ) : (
            letter
          )}
        </span>
        <span className="relative pt-1.5 text-[1.02rem] leading-snug whitespace-pre-line">{text}</span>
      </button>
    </div>
  );
}

function Results({
  questions,
  answers,
  correct,
}: {
  questions: { id: string; text: string; answers: { id: string; text: string }[] }[];
  answers: Record<string, string>;
  correct: Record<string, string | null>;
}) {
  const scored = questions.filter((q) => correct[q.id]);
  const right = scored.filter((q) => answers[q.id] === correct[q.id]).length;
  const ratio = scored.length ? right / scored.length : 1;
  const [shown, setShown] = useState(0);
  const [fill, setFill] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setFill(ratio), 150);
    // count-up
    let n = 0;
    const iv = setInterval(() => {
      n++;
      setShown(Math.min(n, right));
      if (n >= right) clearInterval(iv);
    }, Math.max(60, 900 / Math.max(1, right)));
    // confetti in brand colours
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduce) {
      const colors = ["#63e8c6", "#ff67aa", "#1f1c25", "#ffffff"];
      const fire = (x: number, angle: number) =>
        confetti({ particleCount: 60, spread: 70, angle, origin: { x, y: 0.7 }, colors, scalar: 1.1 });
      setTimeout(() => {
        fire(0.15, 60);
        fire(0.85, 120);
      }, 500);
      if (ratio >= 0.7) setTimeout(() => confetti({ particleCount: 120, spread: 120, origin: { y: 0.4 }, colors }), 1300);
    }
    return () => {
      clearTimeout(t);
      clearInterval(iv);
    };
  }, [right, ratio]);

  const headline =
    ratio >= 0.9 ? "Šťavnatý výkon!" : ratio >= 0.6 ? "Pěkná práce!" : ratio >= 0.3 ? "Dobrý základ!" : "Díky za odpovědi!";

  return (
    <div className="flex flex-col gap-8 pt-2 pb-12">
      <section className="ju-corner-lg anim-rise relative flex items-center gap-5 overflow-hidden bg-ink p-6 text-white sm:p-8">
        <JuiceGlass value={fill} className="h-36 w-auto shrink-0 sm:h-44" />
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold tracking-widest text-mint uppercase">Hotovo</p>
          <h1 className="font-display text-3xl leading-tight font-extrabold sm:text-4xl">{headline}</h1>
          {scored.length > 0 && (
            <p className="text-lg text-white/80">
              Správně{" "}
              <span className="font-display text-3xl font-extrabold text-mint tabular-nums">
                {shown}
              </span>{" "}
              z {scored.length}
            </p>
          )}
          <p className="text-sm text-white/60">Tvoje odpovědi jsme uložili. Teď se můžeš podívat, jak to bylo.</p>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-xl font-bold">Správné odpovědi</h2>
        {questions.map((q, i) => {
          const mine = answers[q.id];
          const ok = correct[q.id];
          const isRight = !!ok && mine === ok;
          return (
            <article
              key={q.id}
              className="ju-corner anim-rise bg-surface p-5"
              style={{ animationDelay: `${300 + i * 70}ms` }}
            >
              <div className="mb-3 flex items-start gap-3">
                <span
                  className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold ${
                    !ok ? "bg-line text-muted" : isRight ? "bg-mint text-ink" : "bg-pink text-white"
                  }`}
                >
                  {!ok ? i + 1 : isRight ? "✓" : "✕"}
                </span>
                <h3 className="font-semibold leading-snug whitespace-pre-line">{q.text}</h3>
              </div>
              <ul className="flex flex-col gap-2 pl-10">
                {q.answers
                  .filter((a) => a.id === ok || a.id === mine)
                  .map((a) => {
                    const isCorrect = a.id === ok;
                    return (
                      <li
                        key={a.id}
                        className={`rounded-[3px_3px_12px_3px] px-3 py-2 text-sm leading-snug whitespace-pre-line ${
                          isCorrect ? "bg-mint-soft" : "bg-pink-soft"
                        }`}
                      >
                        <span className="mb-0.5 block text-xs font-semibold text-muted">
                          {isCorrect && a.id === mine
                            ? "Tvoje odpověď · správně"
                            : isCorrect
                              ? "Správná odpověď"
                              : "Tvoje odpověď"}
                        </span>
                        {a.text}
                      </li>
                    );
                  })}
              </ul>
            </article>
          );
        })}
      </section>
    </div>
  );
}
