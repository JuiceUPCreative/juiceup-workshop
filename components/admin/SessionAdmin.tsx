"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader } from "@/components/Logo";
import type { Session } from "@/lib/types";
import { api } from "./api";
import { useAuthError } from "./AdminGate";
import { StatusBadge } from "./Dashboard";
import { Editor } from "./Editor";
import { downloadQrPng, downloadQrSvg, isLocalOrigin, Qr } from "./Qr";
import { Results } from "./Results";
import { useOrigin } from "./useOrigin";

type Tab = "results" | "questions";

export function SessionAdmin({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const onError = useAuthError();
  const [session, setSession] = useState<Session | null>(null);
  const [count, setCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("results");
  const [dirty, setDirty] = useState(false);
  // In-app links skip beforeunload, so ask before leaving with unsaved edits.
  const guard = (e: React.MouseEvent) => {
    if (dirty && !confirm("Máte neuložené změny v otázkách. Opravdu je chcete opustit?")) e.preventDefault();
  };

  useEffect(() => {
    api<Session & { responseCount: number }>(`/api/admin/sessions/${id}`)
      .then(({ responseCount, ...s }) => {
        setSession(s);
        setCount(responseCount);
        if (s.questions.length === 0) setTab("questions");
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
        <Link href="/admin" className="btn">
          ← Zpět na workshopy
        </Link>
      </div>
    );
  }
  if (!session) return <Loader />;

  const tabs: [Tab, string][] = [
    ["results", `Workshop & výsledky${count ? ` · ${count}` : ""}`],
    ["questions", `Otázky · ${session.questions.length}`],
  ];

  return (
    <div className="flex flex-col gap-6 py-8 sm:py-10">
      <div className="anim-rise flex flex-col gap-4">
        <Link href="/admin" onClick={guard} className="w-fit text-sm font-semibold text-muted hover:text-paper">
          ← Lektorský prostor
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-3">
              <StatusBadge open={session.open} />
              <span className="font-mono text-xs tracking-[0.2em] text-muted">{session.code}</span>
            </div>
            <h1 className="font-display text-3xl leading-tight font-extrabold break-words sm:text-4xl">
              {session.name}
            </h1>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => setOpen(!session.open)}>
            {session.open ? "Uzavřít sběr" : "Znovu otevřít"}
          </button>
        </div>
      </div>

      <nav className="sticky top-0 z-20 -mx-5 flex gap-2 overflow-x-auto border-b border-line bg-bg/90 px-5 py-3 backdrop-blur sm:-mx-8 sm:px-8">
        {tabs.map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm transition-colors ${
              tab === k ? "bg-mint font-bold text-ink" : "text-muted hover:text-paper"
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
      {tab === "results" && (
        <div className="anim-rise flex flex-col gap-6">
          <ShareCard session={session} onPresent={guard} />
          <Results sessionId={id} onCountChange={setCount} />
          <div className="flex justify-end border-t border-line pt-6">
            <button
              className="btn btn-danger btn-sm"
              onClick={async () => {
                if (!confirm(`Smazat workshop „${session.name}“ včetně všech odpovědí? Tohle nejde vrátit.`)) return;
                try {
                  await api(`/api/admin/sessions/${id}`, { method: "DELETE" });
                  router.push("/admin");
                } catch (e) {
                  onError(e);
                }
              }}
            >
              Smazat workshop
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ShareCard({ session, onPresent }: { session: Session; onPresent: (e: React.MouseEvent) => void }) {
  const origin = useOrigin();
  const url = origin ? `${origin}/s/${session.code}` : "";
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <div className="card grid items-center gap-6 p-5 sm:grid-cols-[220px_1fr] sm:gap-8 sm:p-7">
        <div className="mx-auto w-full max-w-[220px] rounded-[20px] bg-white p-4">
          {url && <Qr value={url} className="aspect-square w-full" />}
        </div>
        <div className="flex flex-col gap-3">
          <span className="eyebrow">Pozvěte skupinu</span>
          <h2 className="font-display text-2xl leading-tight font-bold">
            Naskenovat.
            <br />
            Zamyslet se. Odpovědět.
          </h2>
          <p className="text-xs break-all text-muted">
            {url} · kód <strong className="font-mono tracking-[0.2em] text-paper">{session.code}</strong>
          </p>
          <div className="mt-1 flex flex-wrap gap-2">
            <Link href={`/admin/${session.id}/present`} onClick={onPresent} className="btn btn-sm">
              Zobrazit QR ↗
            </Link>
            <button
              className="btn btn-secondary btn-sm"
              onClick={async () => {
                await navigator.clipboard.writeText(url);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <span className="anim-pop text-mint">✓ Zkopírováno</span> : "Kopírovat odkaz"}
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => downloadQrSvg(url, `juiceup-qr-${session.code}.svg`)}
            >
              Stáhnout QR (SVG)
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => downloadQrPng(url, `juiceup-qr-${session.code}.png`)}
            >
              PNG
            </button>
          </div>
        </div>
      </div>
      {url && isLocalOrigin(url) && (
        <p className="note">
          Tento QR kód vede na localhost, takže na telefonech účastníků nebude fungovat. Před promítáním otevřete
          administraci na veřejné adrese aplikace (např. na Vercelu). QR se vždy generuje z adresy, na které je
          administrace otevřená.
        </p>
      )}
      {!session.open && (
        <p className="note">
          Sběr je uzavřený. Účastníci nemohou nově vstoupit ani odeslat odpovědi. Kdo už odeslal, své vyhodnocení
          dál uvidí.
        </p>
      )}
    </div>
  );
}
