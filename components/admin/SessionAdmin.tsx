"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader } from "@/components/Logo";
import type { Session } from "@/lib/types";
import { api, plural } from "./api";
import { useOrigin } from "./useOrigin";
import { useAuthError } from "./AdminGate";
import { Editor, Toggle } from "./Editor";
import { downloadQrPng, Qr } from "./Qr";
import { Results } from "./Results";

type Tab = "questions" | "results" | "share";

export function SessionAdmin({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const onError = useAuthError();
  const [session, setSession] = useState<Session | null>(null);
  const [count, setCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("questions");
  const [dirty, setDirty] = useState(false);
  // In-app links skip beforeunload, so ask before leaving with unsaved edits.
  const guard = (e: React.MouseEvent) => {
    if (dirty && !confirm("Máš neuložené změny v otázkách. Opravdu odejít?")) e.preventDefault();
  };

  useEffect(() => {
    api<Session & { responseCount: number }>(`/api/admin/sessions/${id}`)
      .then(({ responseCount, ...s }) => {
        setSession(s);
        setCount(responseCount);
        // Jump straight to results for workshops that already ran.
        if (responseCount > 0) setTab("results");
      })
      .catch((e) => {
        onError(e);
        setError((e as Error).message);
      });
  }, [id, onError]);

  const setOpen = useCallback(
    async (open: boolean) => {
      if (!session) return;
      setSession({ ...session, open });
      try {
        await api(`/api/admin/sessions/${id}`, { method: "PATCH", json: { open } });
      } catch (e) {
        onError(e);
        setSession({ ...session });
      }
    },
    [id, session, onError],
  );

  if (error) {
    return (
      <div className="flex flex-col items-start gap-4 py-16">
        <h1 className="font-display text-3xl font-bold">{error}</h1>
        <Link href="/admin" className="btn btn-dark">
          ← Zpět na workshopy
        </Link>
      </div>
    );
  }
  if (!session) return <Loader />;

  const tabs: [Tab, string][] = [
    ["questions", "Otázky"],
    ["results", `Výsledky${count ? ` · ${count}` : ""}`],
    ["share", "QR kód"],
  ];

  return (
    <div className="flex flex-col gap-6 py-8">
      <div className="anim-rise flex flex-col gap-4">
        <Link href="/admin" onClick={guard} className="w-fit text-sm font-semibold text-muted hover:text-ink">
          ← Workshopy
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-3xl leading-tight font-extrabold break-words sm:text-4xl">
              {session.name}
            </h1>
            <p className="mt-1 text-sm text-muted">
              Kód <span className="font-mono font-semibold tracking-widest text-ink">{session.code}</span> ·{" "}
              {session.questions.length} {plural(session.questions.length, "otázka", "otázky", "otázek")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setOpen(!session.open)}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                session.open ? "bg-mint-soft hover:bg-mint" : "bg-line text-muted hover:bg-ink/15"
              }`}
              title={session.open ? "Klikni pro uzavření" : "Klikni pro otevření"}
            >
              <span
                className={`h-2 w-2 rounded-full ${session.open ? "animate-pulse bg-mint-strong" : "bg-muted"}`}
              />
              {session.open ? "Přijímá odpovědi" : "Uzavřeno"}
            </button>
            <Link href={`/admin/${id}/present`} onClick={guard} className="btn btn-dark btn-sm">
              ▶ Prezentovat QR
            </Link>
          </div>
        </div>
      </div>

      <nav className="sticky top-16 z-20 -mx-5 flex gap-1 overflow-x-auto bg-bg/85 px-5 py-2 backdrop-blur">
        {tabs.map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`relative shrink-0 rounded-[3px_3px_14px_3px] px-4 py-2 font-display font-bold transition-colors ${
              tab === k ? "bg-ink text-white" : "text-muted hover:bg-surface hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* Editor stays mounted so unsaved edits survive switching tabs. */}
      <div className={tab === "questions" ? "anim-rise" : "hidden"}>
        <Editor session={session} responseCount={count} onSaved={(s) => setSession(s)} onDirtyChange={setDirty} />
      </div>
      <div key={tab} className="anim-rise">
        {tab === "results" && <Results sessionId={id} onCountChange={setCount} />}
        {tab === "share" && (
          <Share
            session={session}
            onOpenChange={setOpen}
            onDelete={async () => {
              if (!confirm(`Smazat workshop „${session.name}“ včetně všech odpovědí?`)) return;
              try {
                await api(`/api/admin/sessions/${id}`, { method: "DELETE" });
                router.push("/admin");
              } catch (e) {
                onError(e);
              }
            }}
          />
        )}
      </div>
    </div>
  );
}

function Share({
  session,
  onOpenChange,
  onDelete,
}: {
  session: Session;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
}) {
  const origin = useOrigin();
  const url = origin ? `${origin}/s/${session.code}` : "";
  const [copied, setCopied] = useState(false);

  return (
    <div className="grid gap-6 pb-16 lg:grid-cols-[minmax(0,420px)_1fr]">
      <div className="ju-corner-lg bg-surface p-6 sm:p-8">
        {url && <Qr value={url} className="aspect-square w-full" />}
      </div>
      <div className="flex flex-col gap-5">
        <div className="ju-corner flex flex-col gap-3 bg-surface p-5">
          <span className="text-sm font-semibold">Odkaz pro účastníky</span>
          <div className="flex gap-2">
            <input className="input font-mono text-sm" readOnly value={url} onFocus={(e) => e.target.select()} />
            <button
              className="btn btn-sm shrink-0"
              onClick={async () => {
                await navigator.clipboard.writeText(url);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <span className="anim-pop">✓ Zkopírováno</span> : "Kopírovat"}
            </button>
          </div>
          <p className="text-sm text-muted">
            Účastníci se můžou připojit i zadáním kódu{" "}
            <strong className="font-mono tracking-widest text-ink">{session.code}</strong> na úvodní stránce.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href={`/admin/${session.id}/present`} className="btn btn-dark">
            ▶ Prezentační režim
          </Link>
          <button className="btn btn-ghost" onClick={() => downloadQrPng(url, `qr-${session.code}.png`)}>
            Stáhnout QR (PNG)
          </button>
          <a className="btn btn-ghost" href={url} target="_blank" rel="noreferrer">
            Vyzkoušet jako účastník ↗
          </a>
        </div>

        <div className="ju-corner bg-surface p-5">
          <Toggle
            checked={session.open}
            onChange={onOpenChange}
            label="Přijímat odpovědi"
            hint="Po vypnutí se formulář účastníkům zavře a nové odpovědi se už nepřijmou."
          />
        </div>

        <div className="mt-auto pt-4">
          <button className="text-sm font-semibold text-pink hover:underline" onClick={onDelete}>
            Smazat workshop
          </button>
        </div>
      </div>
    </div>
  );
}
