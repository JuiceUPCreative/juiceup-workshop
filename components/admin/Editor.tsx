"use client";

import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { randomId } from "@/lib/ids";
import { type Lang, LANGS, normalizeLang } from "@/lib/i18n";
import type { Question, Session } from "@/lib/types";
import { api, plural } from "./api";
import { useAuthError } from "./AdminGate";

type Draft = Pick<Session, "name" | "intro" | "language" | "shuffleAnswers" | "questions">;

const LETTERS = "ABCDEFGHIJKL";

function draftOf(s: Session): Draft {
  return {
    name: s.name,
    intro: s.intro,
    language: normalizeLang(s.language),
    shuffleAnswers: s.shuffleAnswers,
    questions: s.questions,
  };
}

function blankQuestion(): Question {
  const answers = [0, 1, 2, 3].map(() => ({ id: randomId(), text: "" }));
  return { id: randomId(), text: "", answers, correctId: null, explanation: "" };
}

function move<T>(arr: T[], from: number, to: number): T[] {
  const out = arr.slice();
  const [x] = out.splice(from, 1);
  out.splice(to, 0, x);
  return out;
}

export function Editor({
  session,
  responseCount,
  onSaved,
  onDirtyChange,
}: {
  session: Session;
  responseCount: number;
  onSaved: (s: Session) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const onError = useAuthError();
  const [draft, setDraft] = useState<Draft>(() => draftOf(session));
  const [saved, setSaved] = useState(() => JSON.stringify(draftOf(session)));
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const dirty = JSON.stringify(draft) !== saved;
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  async function save() {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      const s = await api<Session>(`/api/admin/sessions/${session.id}`, { method: "PATCH", json: draft });
      setSaved(JSON.stringify(draftOf(s)));
      setDraft(draftOf(s));
      onSaved(s);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1800);
    } catch (e) {
      onError(e);
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  const onSaveShortcut = useEffectEvent(() => void save());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        onSaveShortcut();
      }
    };
    const onLeave = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onLeave);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onLeave);
    };
  }, [dirty]);

  const setQuestions = (fn: (qs: Question[]) => Question[]) =>
    setDraft((d) => ({ ...d, questions: fn(d.questions) }));
  const setQuestion = (id: string, fn: (q: Question) => Question) =>
    setQuestions((qs) => qs.map((q) => (q.id === id ? fn(q) : q)));

  const pollCount = draft.questions.filter((q) => !q.correctId).length;

  return (
    <div className="flex flex-col gap-6 pb-32">
      <section className="card grid gap-5 p-5 sm:p-7">
        <div className="grid gap-5 sm:grid-cols-[1fr_12rem]">
          <label className="flex flex-col">
            <span className="label">Název workshopu</span>
            <input
              className="input font-display text-lg font-bold"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <label className="flex flex-col">
            <span className="label">Jazyk pro účastníky</span>
            <select
              className="input h-full"
              value={draft.language}
              onChange={(e) => setDraft({ ...draft, language: e.target.value as Lang })}
            >
              {LANGS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex flex-col">
          <span className="label">Úvodní text (nepovinné)</span>
          <AutoTextarea
            className="input"
            placeholder=""
            value={draft.intro}
            onChange={(v) => setDraft({ ...draft, intro: v })}
          />
        </label>
        <Toggle
          checked={draft.shuffleAnswers}
          onChange={(v) => setDraft({ ...draft, shuffleAnswers: v })}
          label="Zamíchat pořadí odpovědí"

        />
      </section>

      {responseCount > 0 && (
        <p className="note">
          Už {responseCount} {plural(responseCount, "odpověď", "odpovědi", "odpovědí")}. Smazání otázky nebo změna
          správné odpovědi ovlivní výsledky.
        </p>
      )}

      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-bold">
          Otázky <span className="text-muted">{draft.questions.length}</span>
        </h2>
        {pollCount > 0 && (
          <span className="rounded-full bg-line px-3 py-1 text-xs font-semibold text-muted">
            {pollCount}× anketa
          </span>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {draft.questions.map((q, qi) => (
          <QuestionCard
            key={q.id}
            q={q}
            index={qi}
            total={draft.questions.length}
            autoFocus={focusId === q.id}
            dragging={dragIndex === qi}
            onDragStart={() => setDragIndex(qi)}
            onDragEnter={() => {
              if (dragIndex === null || dragIndex === qi) return;
              setQuestions((qs) => move(qs, dragIndex, qi));
              setDragIndex(qi);
            }}
            onDragEnd={() => setDragIndex(null)}
            onChange={(fn) => setQuestion(q.id, fn)}
            onMove={(to) => setQuestions((qs) => move(qs, qi, to))}
            onDuplicate={() =>
              setQuestions((qs) => {
                const idMap = new Map(q.answers.map((a) => [a.id, randomId()]));
                const copy: Question = {
                  id: randomId(),
                  text: q.text,
                  answers: q.answers.map((a) => ({ id: idMap.get(a.id)!, text: a.text })),
                  correctId: q.correctId ? idMap.get(q.correctId)! : null,
                  explanation: q.explanation ?? "",
                };
                const out = qs.slice();
                out.splice(qi + 1, 0, copy);
                return out;
              })
            }
            onDelete={() => {
              if (q.text.trim() && !confirm("Opravdu smazat tuto otázku?")) return;
              setQuestions((qs) => qs.filter((x) => x.id !== q.id));
            }}
          />
        ))}
      </div>

      <button
        className="group flex items-center justify-center gap-2 rounded-[24px] border-2 border-dashed border-line-strong py-6 font-display font-bold text-muted transition-colors hover:border-mint hover:bg-mint/5 hover:text-paper"
        onClick={() => {
          const q = blankQuestion();
          setQuestions((qs) => [...qs, q]);
          setFocusId(q.id);
        }}
      >
        <span className="grid h-7 w-7 place-items-center rounded-full bg-line transition-transform group-hover:rotate-90 group-hover:bg-mint group-hover:text-ink">
          +
        </span>
        Přidat otázku
      </button>

      {/* Save bar: portalled to <body>, because the editor's animated (transformed) wrappers
          would otherwise make `position: fixed` stick to the wrapper instead of the screen. */}
      {typeof document !== "undefined" &&
        createPortal(
          <div
            className={`fixed inset-x-0 bottom-0 z-40 transition-transform duration-300 ${
              dirty || justSaved ? "translate-y-0" : "pointer-events-none translate-y-[calc(100%+2rem)]"
            }`}
            style={{ transitionTimingFunction: "cubic-bezier(0.34, 1.4, 0.64, 1)" }}
          >
            <div className="mx-auto mb-4 flex w-[calc(100%-2.5rem)] max-w-3xl items-center justify-between gap-4 rounded-full border border-line-strong bg-surface-2 py-2 pr-2 pl-6 text-paper shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]">
              <span className="text-sm">
                {justSaved && !dirty ? (
                  <span className="anim-pop inline-flex items-center gap-2 text-mint">✓ Uloženo</span>
                ) : (
                  <>
                    Neuložené změny <span className="hidden text-muted sm:inline">· ⌘S</span>
                  </>
                )}
              </span>
              <div className="flex gap-2">
                {dirty && (
                  <button
                    className="btn btn-sm bg-transparent text-muted hover:bg-line hover:text-paper hover:shadow-none"
                    onClick={() => setDraft(JSON.parse(saved))}
                  >
                    Zahodit
                  </button>
                )}
                <button className="btn btn-sm" disabled={!dirty || saving} onClick={save}>
                  {saving ? "Ukládáme…" : "Uložit změny ✓"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function QuestionCard({
  q,
  index,
  total,
  autoFocus,
  dragging,
  onDragStart,
  onDragEnter,
  onDragEnd,
  onChange,
  onMove,
  onDuplicate,
  onDelete,
}: {
  q: Question;
  index: number;
  total: number;
  autoFocus: boolean;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnter: () => void;
  onDragEnd: () => void;
  onChange: (fn: (q: Question) => Question) => void;
  onMove: (to: number) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [draggable, setDraggable] = useState(false);
  const [newAnswerId, setNewAnswerId] = useState<string | null>(null);
  const isPoll = !q.correctId;

  return (
    <article
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnter={onDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDragEnd={() => {
        setDraggable(false);
        onDragEnd();
      }}
      className={`card anim-rise p-4 transition-[opacity,transform,border-color] duration-200 sm:p-6 ${
        dragging ? "scale-[0.99] border-mint opacity-50" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <button
          className="mt-1 flex h-9 w-9 shrink-0 cursor-grab touch-none flex-col items-center justify-center rounded-full bg-mint font-display text-sm font-bold text-ink active:cursor-grabbing"
          title="Přetáhni pro změnu pořadí"
          onPointerDown={() => setDraggable(true)}
          onPointerUp={() => setDraggable(false)}
        >
          {index + 1}
        </button>
        <AutoTextarea
          className="input flex-1 font-display text-lg font-bold"
          placeholder="Text otázky…"
          value={q.text}
          autoFocus={autoFocus}
          onChange={(v) => onChange((x) => ({ ...x, text: v }))}
        />
        <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
          <IconButton title="Posunout nahoru" disabled={index === 0} onClick={() => onMove(index - 1)}>
            ↑
          </IconButton>
          <IconButton title="Posunout dolů" disabled={index === total - 1} onClick={() => onMove(index + 1)}>
            ↓
          </IconButton>
          <IconButton title="Duplikovat" onClick={onDuplicate}>
            ⧉
          </IconButton>
          <IconButton title="Smazat otázku" danger onClick={onDelete}>
            ✕
          </IconButton>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:pl-12">
        <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
          {isPoll && (
            <span className="rounded-full bg-line px-2 py-0.5 font-semibold text-paper">Anketa</span>
          )}
          {isPoll
            ? "Bez správné odpovědi. Kliknutím na písmeno ji označíte."
            : "Opětovným kliknutím na ✓ z otázky uděláte anketu."}
        </p>
        {q.answers.map((a, ai) => {
          const correct = q.correctId === a.id;
          return (
            <div key={a.id} className="group/answer flex items-start gap-2">
              <button
                title={correct ? "Zrušit správnou odpověď (anketa)" : "Označit jako správnou"}
                onClick={() => onChange((x) => ({ ...x, correctId: x.correctId === a.id ? null : a.id }))}
                className={`mt-2 grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold transition-all duration-200 ${
                  correct
                    ? "anim-pop bg-mint text-ink"
                    : "border border-dim text-muted hover:border-mint hover:text-paper"
                }`}
              >
                {correct ? "✓" : LETTERS[ai]}
              </button>
              <AutoTextarea
                className={`input flex-1 text-[0.95rem] leading-relaxed ${correct ? "border-mint! bg-mint/[0.06]!" : ""}`}
                placeholder={`Odpověď ${LETTERS[ai]}…`}
                value={a.text}
                autoFocus={newAnswerId === a.id}
                onChange={(v) =>
                  onChange((x) => ({
                    ...x,
                    answers: x.answers.map((y) => (y.id === a.id ? { ...y, text: v } : y)),
                  }))
                }
              />
              <div className="mt-1 flex shrink-0 flex-col opacity-100 transition-opacity sm:flex-row sm:opacity-0 sm:group-hover/answer:opacity-100 sm:group-focus-within/answer:opacity-100">
                <IconButton
                  small
                  title="Posunout nahoru"
                  disabled={ai === 0}
                  onClick={() => onChange((x) => ({ ...x, answers: move(x.answers, ai, ai - 1) }))}
                >
                  ↑
                </IconButton>
                <IconButton
                  small
                  title="Posunout dolů"
                  disabled={ai === q.answers.length - 1}
                  onClick={() => onChange((x) => ({ ...x, answers: move(x.answers, ai, ai + 1) }))}
                >
                  ↓
                </IconButton>
                <IconButton
                  small
                  danger
                  title="Smazat odpověď"
                  disabled={q.answers.length <= 2}
                  onClick={() =>
                    onChange((x) => ({
                      ...x,
                      answers: x.answers.filter((y) => y.id !== a.id),
                      correctId: x.correctId === a.id ? null : x.correctId,
                    }))
                  }
                >
                  ✕
                </IconButton>
              </div>
            </div>
          );
        })}
        {q.answers.length < 12 && (
          <button
            className="btn btn-secondary btn-sm mt-1 self-start"
            onClick={() => {
              const id = randomId();
              setNewAnswerId(id);
              onChange((x) => ({ ...x, answers: [...x.answers, { id, text: "" }] }));
            }}
          >
            + Odpověď
          </button>
        )}
        <label className="mt-4 flex flex-col">
          <span className="label">Vysvětlení (uvidí po odeslání, nepovinné)</span>
          <AutoTextarea
            className="input text-[0.95rem] leading-relaxed"
            placeholder=""
            value={q.explanation ?? ""}
            onChange={(v) => onChange((x) => ({ ...x, explanation: v }))}
          />
        </label>
      </div>
    </article>
  );
}

function IconButton({
  children,
  danger,
  small,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { danger?: boolean; small?: boolean }) {
  return (
    <button
      {...props}
      className={`grid shrink-0 place-items-center rounded-[10px] border border-line text-muted transition-all active:scale-90 disabled:pointer-events-none disabled:opacity-25 ${
        small ? "h-7 w-7 text-sm" : "h-9 w-9"
      } ${danger ? "hover:border-pink hover:text-pink" : "hover:border-mint hover:text-paper"}`}
    >
      {children}
    </button>
  );
}

function AutoTextarea({
  value,
  onChange,
  className,
  placeholder,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight + 3}px`;
    };
    fit();
    // Re-measure when the width changes — e.g. the editor tab was hidden while mounting.
    let lastWidth = el.clientWidth;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth !== lastWidth) {
        lastWidth = el.clientWidth;
        fit();
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [value]);
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);
  return (
    <textarea
      ref={ref}
      rows={1}
      className={`resize-none overflow-hidden ${className ?? ""}`}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ${
          checked ? "bg-mint" : "bg-line-strong"
        }`}
      >
        <span
          className="absolute top-1 left-1 h-5 w-5 rounded-full bg-paper shadow"
          style={{
            transform: checked ? "translateX(20px)" : "none",
            transition: "transform 260ms cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        />
      </button>
      <span className="flex flex-col">
        <span className="font-semibold">{label}</span>
        {hint && <span className="text-sm text-muted">{hint}</span>}
      </span>
    </label>
  );
}
