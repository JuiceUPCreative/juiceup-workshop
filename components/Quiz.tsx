"use client";

import { createContext, use, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import confetti from "canvas-confetti";
import { Loader, SiteHeader } from "@/components/Logo";
import { JuiceGlass, JuiceProgress } from "@/components/JuiceProgress";
import { browserLang, type Dict, dictionaries, type PublicErrorCode } from "@/lib/i18n";
import { type Feedback, OPEN_ANSWER_MAX, type PublicSession } from "@/lib/types";

type Saved = {
  seed: number;
  index: number;
  answers: Record<string, string>;
  /** Text typed into an "other" option, per question. */
  texts?: Record<string, string>;
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
function freshState(): Saved {
  return { seed: Math.floor(Math.random() * 2 ** 31), index: 0, answers: {}, started: false };
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

/** Participant texts in the workshop's language. */
const T = createContext<Dict>(dictionaries.cs);
const useT = () => useContext(T);

class ApiError extends Error {
  constructor(public code: PublicErrorCode | "network" | "unknown") {
    super(code);
  }
}

async function apiError(r: Response): Promise<ApiError> {
  const data = await r.json().catch(() => null);
  return new ApiError(data?.code ?? "unknown");
}

export function Quiz({ params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = use(params);
  const code = rawCode.toUpperCase();

  const [session, setSession] = useState<PublicSession | null>(null);
  const [error, setError] = useState<ApiError["code"] | null>(null);
  const [state, setState] = useState<Saved | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<ApiError["code"] | null>(null);
  const t = dictionaries[session?.language ?? (error ? browserLang() : "cs")];

  useEffect(() => {
    if (session) document.documentElement.lang = session.language;
  }, [session]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/s/${encodeURIComponent(code)}`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw await apiError(r);
        return r.json() as Promise<PublicSession>;
      })
      .then((s) => {
        if (cancelled) return;
        setSession(s);
        setState(loadSaved(code) ?? freshState());
      })
      .catch((e) => !cancelled && setError(e instanceof ApiError ? e.code : "network"));
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
      // The "other" option always stays last, even when shuffling.
      answers: session.shuffleAnswers
        ? [
            ...seededShuffle(
              q.answers.filter((a) => !a.open),
              state.seed + q.id.charCodeAt(0) * 31 + q.id.length,
            ),
            ...q.answers.filter((a) => a.open),
          ]
        : q.answers,
    }));
  }, [session, state?.seed]); // eslint-disable-line react-hooks/exhaustive-deps

  async function start() {
    setBusy(true);
    setActionError(null);
    try {
      const r = await fetch(`/api/s/${encodeURIComponent(code)}/start`, { method: "POST" });
      if (!r.ok) throw await apiError(r);
      const data = await r.json();
      update({ started: true, pid: data.pid });
    } catch (e) {
      // Starting offline is fine — the submit creates the participant anyway.
      if (e instanceof ApiError && e.code === "closed") setActionError("closed");
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
        body: JSON.stringify({ answers: state.answers, texts: state.texts ?? {}, pid: state.pid }),
      });
      if (!r.ok) throw await apiError(r);
      const data = await r.json();
      update({ feedback: data.feedback });
      buzz(30);
      window.scrollTo({ top: 0 });
    } catch (e) {
      setActionError(e instanceof ApiError ? e.code : "network");
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <Shell t={t}>
        <Message eyebrow={t.errorEyebrow} title={error === "network" || error === "unknown" ? t.loadFailed : t.errors[error]}>
          <p>{t.checkCode}</p>
          <Link href="/" className="btn mt-4 w-fit">
            {t.enterCode}
          </Link>
        </Message>
      </Shell>
    );
  }

  if (!session || !state) {
    return (
      <Shell t={t}>
        <Loader label={t.loading} />
      </Shell>
    );
  }

  if (state.feedback) {
    return (
      <Shell t={t}>
        <Results
          questions={questions}
          answers={state.answers}
          texts={state.texts ?? {}}
          feedback={state.feedback}
          thankYouTitle={session.thankYouTitle}
          thankYou={session.thankYou}
          onRestart={() => {
            // Shared device: start over as a new anonymous participant.
            // The previous submission stays on the server.
            const next = freshState();
            persist(code, next);
            setState(next);
            setActionError(null);
            window.scrollTo({ top: 0 });
          }}
        />
      </Shell>
    );
  }

  if (!session.open) {
    return (
      <Shell t={t}>
        <Message eyebrow={session.name} title={<span className="text-pink">{t.closedTitle}</span>}>
          <p>{t.closedText}</p>
        </Message>
      </Shell>
    );
  }

  if (questions.length === 0) {
    return (
      <Shell t={t}>
        <Message eyebrow={session.name} title={t.noQuestions}>
          <p>{t.tryLater}</p>
        </Message>
      </Shell>
    );
  }

  if (!state.started) {
    return (
      <Shell t={t}>
        <Intro session={session} count={questions.length} busy={busy} error={actionError} onStart={start} />
      </Shell>
    );
  }

  const index = Math.min(state.index, questions.length - 1);
  const q = questions[index];
  // Open answers count only once they contain more than whitespace.
  const has = (id: string) => {
    if (!state.answers[id]?.trim()) return false;
    // A chosen "other" option also needs its text.
    const other = questions.find((x) => x.id === id)?.answers.find((a) => a.id === state.answers[id] && a.open);
    return !other || !!state.texts?.[id]?.trim();
  };
  const answeredCount = questions.filter((x) => has(x.id)).length;
  const isLast = index === questions.length - 1;
  const allAnswered = answeredCount === questions.length;
  const missing = questions.length - answeredCount;

  return (
    <Shell t={t}>
      <div className="flex flex-col gap-4 pt-2">
        <div className="flex items-center justify-between gap-4">
          <span className="eyebrow truncate">{session.name}</span>
          <span className="shrink-0 text-xs text-muted tabular-nums">
            {t.answeredOf(answeredCount, questions.length)}
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
        otherText={state.texts?.[q.id] ?? ""}
        onText={(text) => update({ answers: { ...state.answers, [q.id]: text } })}
        onOtherText={(text) => update({ texts: { ...state.texts, [q.id]: text } })}
        onSelect={(answerId) => {
          const first = !state.answers[q.id];
          update({ answers: { ...state.answers, [q.id]: answerId } });
          buzz();
          // Auto-advance on the first pick — feels snappy; changing an answer stays put.
          // Not for "other": the participant still has to type.
          const isOther = q.answers.find((a) => a.id === answerId)?.open;
          if (first && !isLast && !isOther) setTimeout(() => update({ index: index + 1 }), 650);
        }}
      />

      <div data-quiz-footer className="sticky bottom-0 -mx-5 mt-auto flex flex-col gap-3 bg-gradient-to-t from-bg via-bg to-bg/0 px-5 pt-8 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:-mx-8 sm:px-8">
        {isLast && !allAnswered && (
          <p className="text-center text-sm text-muted">
            {t.missing(missing)}{" "}
            <button
              className="font-semibold text-mint underline underline-offset-4"
              onClick={() => update({ index: questions.findIndex((x) => !has(x.id)) })}
            >
              {t.goToMissing}
            </button>
          </p>
        )}
        {actionError && (
          <p className="text-center text-sm font-semibold text-pink">
            {actionError === "network" || actionError === "unknown" ? t.network : t.errors[actionError]}
          </p>
        )}
        <div className="flex items-center justify-between gap-3">
          <button className="btn btn-secondary" disabled={index === 0} onClick={() => update({ index: index - 1 })}>
            {t.back}
          </button>
          {isLast ? (
            <button className="btn btn-pink" disabled={!allAnswered || busy} onClick={submit}>
              {busy ? t.submitting : t.submit}
            </button>
          ) : (
            <button className="btn" disabled={!has(q.id)} onClick={() => update({ index: index + 1 })}>
              {t.next}
            </button>
          )}
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children, t }: { children: React.ReactNode; t: Dict }) {
  return (
    <T.Provider value={t}>
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 pt-6 sm:px-8 sm:pt-10">{children}</main>
    </div>
    </T.Provider>
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
  error: ApiError["code"] | null;
  onStart: () => void;
}) {
  const t = useT();
  return (
    <div className="anim-rise flex flex-1 flex-col justify-center gap-6 py-8">
      <h1 className="font-display text-4xl leading-[1.05] font-extrabold sm:text-6xl">{session.name}</h1>
      {session.intro && <p className="max-w-xl text-lg leading-relaxed whitespace-pre-line text-muted">{session.intro}</p>}
      <p className="text-muted">
        {t.introCount(count)}
      </p>
      {error && (
        <p className="text-sm font-semibold text-pink">
          {error === "network" || error === "unknown" ? t.network : t.errors[error]}
        </p>
      )}
      <button className="btn w-fit px-10" onClick={onStart} disabled={busy}>
        {busy ? "…" : t.start}
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
  const t = useT();
  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label={t.questionsAria}>
      {questions.map((q, i) => {
        const done = !!answers[q.id];
        return (
          <button
            key={q.id}
            role="tab"
            aria-selected={i === current}
            aria-label={t.stepAria(i + 1, done)}
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
  otherText,
  onSelect,
  onText,
  onOtherText,
}: {
  number: number;
  total: number;
  q: Q;
  selected?: string;
  otherText: string;
  onSelect: (id: string) => void;
  onText: (text: string) => void;
  onOtherText: (text: string) => void;
}) {
  const t = useT();
  return (
    <section className="flex shrink-0 flex-col gap-6 pt-8 pb-2">
      <div className="anim-rise">
        <span className="eyebrow mb-4">
          {t.questionOf(number, total)}
        </span>
        <h1 className="font-display text-[1.75rem] leading-tight font-bold whitespace-pre-line sm:text-4xl">{q.text}</h1>
      </div>
      {q.type === "open" ? (
        <div className="anim-rise [animation-delay:60ms]">
          <textarea
            className="input min-h-40 resize-y rounded-[20px] p-5 text-base leading-relaxed"
            placeholder={t.openPlaceholder}
            value={selected ?? ""}
            maxLength={OPEN_ANSWER_MAX}
            onChange={(e) => onText(e.target.value)}
            aria-label={q.text}
          />
          {(selected?.length ?? 0) > OPEN_ANSWER_MAX * 0.8 && (
            <p className="mt-1 text-right text-xs text-muted tabular-nums">
              {selected!.length} / {OPEN_ANSWER_MAX}
            </p>
          )}
        </div>
      ) : (
      <div className="flex flex-col gap-3" role="radiogroup" aria-label={t.pickOne}>
        {q.answers.map((a, i) => (
          <AnswerCard
            key={a.id}
            letter={LETTERS[i]}
            text={a.text}
            selected={selected === a.id}
            delay={60 + i * 60}
            onClick={() => onSelect(a.id)}
            other={a.open ? { value: otherText, onChange: onOtherText, placeholder: t.otherPlaceholder } : undefined}
          />
        ))}
      </div>
      )}
    </section>
  );
}

/**
 * Scrolls so `el` sits fully above the sticky footer and within the visible
 * area (the on-screen keyboard shrinks the visual viewport on phones).
 */
function revealAboveFooter(el: HTMLElement) {
  const vv = window.visualViewport;
  const viewTop = vv ? vv.offsetTop : 0;
  const viewBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
  const footerTop = document.querySelector("[data-quiz-footer]")?.getBoundingClientRect().top ?? viewBottom;
  const limit = Math.min(viewBottom, footerTop) - 12;
  const r = el.getBoundingClientRect();
  if (r.bottom > limit) window.scrollBy({ top: r.bottom - limit, behavior: "smooth" });
  else if (r.top < viewTop + 72) window.scrollBy({ top: r.top - viewTop - 72, behavior: "smooth" });
}

function AnswerCard({
  letter,
  text,
  selected,
  delay,
  onClick,
  other,
}: {
  letter: string;
  text: string;
  selected: boolean;
  delay: number;
  onClick: () => void;
  /** Set for the "other" option: a text field that opens below it when chosen. */
  other?: { value: string; onChange: (v: string) => void; placeholder: string };
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const otherRef = useRef<HTMLTextAreaElement>(null);
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
          if (other && otherRef.current) {
            // Focus synchronously inside the tap, otherwise iOS won't open the keyboard.
            otherRef.current.focus({ preventScroll: true });
            // Bring the field above the sticky footer once it has expanded, and again
            // when the on-screen keyboard shrinks the visible area.
            const ta = otherRef.current;
            const reveal = () => revealAboveFooter(ta);
            // Once mid-expansion and once after it, plus when the keyboard opens.
            setTimeout(reveal, 200);
            setTimeout(reveal, 450);
            window.visualViewport?.addEventListener("resize", () => setTimeout(reveal, 50), { once: true });
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
      {other && (
        // Always mounted (just collapsed) so it can take focus in the same tap that selects it.
        <div
          className="grid transition-[grid-template-rows,opacity] duration-300 ease-out"
          style={{ gridTemplateRows: selected ? "1fr" : "0fr", opacity: selected ? 1 : 0 }}
        >
          <div className="overflow-hidden">
            <textarea
              ref={otherRef}
              className="input mt-2 min-h-24 resize-y rounded-[16px] leading-relaxed"
              placeholder={other.placeholder}
              value={other.value}
              maxLength={OPEN_ANSWER_MAX}
              onChange={(e) => other.onChange(e.target.value)}
              tabIndex={selected ? 0 : -1}
              aria-hidden={!selected}
              aria-label={text}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Results({
  questions,
  answers,
  feedback,
  texts,
  thankYou,
  thankYouTitle,
  onRestart,
}: {
  thankYouTitle: string;
  texts: Record<string, string>;
  thankYou: string;
  onRestart: () => void;
  questions: Q[];
  answers: Record<string, string>;
  feedback: Feedback;
}) {
  const t = useT();
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
            {thankYouTitle.trim() || t.submitted}
          </h1>
          {thankYou.trim() && (
            <p className="anim-rise max-w-xl text-lg leading-relaxed whitespace-pre-line text-muted [animation-delay:90ms]">
              {thankYou}
            </p>
          )}
          <button className="btn btn-secondary btn-sm anim-rise w-fit [animation-delay:120ms]" onClick={onRestart}>
            ↻ {t.fillAgain}
          </button>
        </div>
        {scored.length > 0 && (
          <div className="card anim-rise flex items-center gap-4 self-start p-5 [animation-delay:180ms] sm:self-auto">
            <JuiceGlass value={fill} className="h-24 w-auto shrink-0" />
            <p className="max-w-[11rem] text-sm leading-snug text-muted">
              <span className="font-display block text-3xl font-extrabold text-paper tabular-nums">
                {t.scoreOf(right, scored.length)}
              </span>
              {t.correctSuffix}
            </p>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        {questions.map((q, i) => {
          const mine = answers[q.id];
          const fb = feedback[q.id] ?? { correctId: null, explanation: "" };
          const isOpenQ = q.type === "open";
          const isPoll = !fb.correctId;
          const matches = !isPoll && mine === fb.correctId;
          return (
            <article key={q.id} className="card anim-rise p-5 sm:p-7" style={{ animationDelay: `${250 + i * 70}ms` }}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <span className="eyebrow">{t.question(i + 1)}</span>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    isPoll ? "bg-line text-paper" : matches ? "bg-mint/15 text-mint" : "bg-pink/15 text-pink"
                  }`}
                >
                  {isOpenQ ? t.openBadge : isPoll ? t.poll : matches ? t.right : t.wrong}
                </span>
              </div>
              <h2 className="mb-4 text-lg leading-snug font-bold whitespace-pre-line">{q.text}</h2>
              {isOpenQ && (
                <div className="rounded-xl border border-paper/40 bg-surface-2 px-4 py-3 text-[15px] leading-relaxed">
                  <span className="mb-1 block text-xs font-bold text-muted">{t.yourAnswer}</span>
                  <span className="whitespace-pre-line">{mine}</span>
                </div>
              )}
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
                        {isMine && a.open && texts[q.id] && (
                          <span className="mt-1 block text-paper italic">„{texts[q.id]}“</span>
                        )}
                        {(isMine || isCorrect) && (
                          <span className="mt-1 flex flex-wrap gap-x-3 text-xs font-bold">
                            {isMine && <span>{t.yourChoice}</span>}
                            {isCorrect && <span className="text-mint">{t.correctAnswer}</span>}
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

      <button className="btn btn-secondary w-fit" onClick={onRestart}>
        ↻ {t.fillAgain}
      </button>
    </div>
  );
}
