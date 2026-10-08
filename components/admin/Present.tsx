"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Drop, Loader, Logo } from "@/components/Logo";
import { dictionaries, normalizeLang } from "@/lib/i18n";
import type { Session } from "@/lib/types";
import { api } from "./api";
import { useAuthError } from "./AdminGate";
import { useOrigin } from "./useOrigin";
import { Qr } from "./Qr";
import { ThemeToggle } from "@/components/ThemeToggle";

/** Full-screen view for the projector: QR code + live response counter. */
export function Present({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const onError = useAuthError();
  const [session, setSession] = useState<(Session & { responseCount: number }) | null>(null);
  const origin = useOrigin();
  const [bump, setBump] = useState(0);
  const prev = useRef<number | null>(null);
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.push(`/admin/${id}`);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [id, router]);

  useEffect(() => {
    let alive = true;
    const tick = () =>
      api<Session & { responseCount: number }>(`/api/admin/sessions/${id}`)
        .then((s) => {
          if (!alive) return;
          if (prev.current !== null && s.responseCount > prev.current) setBump((b) => b + 1);
          prev.current = s.responseCount;
          setSession(s);
        })
        .catch(onError);
    tick();
    const iv = setInterval(tick, 3000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [id, onError]);

  if (!session) return <Loader />;
  // Projected for participants, so it follows the workshop language.
  const t = dictionaries[normalizeLang(session.language)];
  const url = `${origin}/s/${session.code}`;
  const displayUrl = url.replace(/^https?:\/\//, "");

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-bg text-paper">
      <Drop className="anim-float pointer-events-none absolute -top-10 left-[42%] h-48 w-40 text-mint/15" />
      <Drop className="anim-float pointer-events-none absolute -bottom-8 left-8 h-32 w-24 text-pink/25 [animation-delay:-3s]" />

      <header className="relative flex items-center justify-between px-8 pt-6 lg:px-14">
        <Logo className="h-8 w-auto text-paper" />
        <div className="flex items-center gap-2">
          <Link href={`/admin/${id}`} className="btn btn-secondary btn-sm">
            Zavřít × <span className="text-muted">Esc</span>
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <div className="relative grid flex-1 items-center gap-10 px-8 py-10 lg:grid-cols-[1.1fr_1fr] lg:px-14">
        <div className="flex flex-col gap-8">
          <span className="eyebrow">JuiceUP · {session.name}</span>
          <h1 className="font-display text-5xl leading-[1.02] font-extrabold xl:text-7xl">
            {t.scan}
            <br />
            <span className="text-mint">{t.qrCode}</span>
          </h1>
          <div className="flex flex-col gap-2 text-muted">
            <span className="text-lg">{t.or}</span>
            <span className="font-display text-2xl font-bold break-all text-paper xl:text-3xl">{displayUrl}</span>
          </div>
          <div key={bump} className="flex items-center gap-4">
            <span
              className={`font-display text-7xl leading-none font-extrabold text-mint tabular-nums ${bump ? "anim-pop" : ""}`}
            >
              {session.responseCount}
            </span>
            <span className="text-xl text-muted">{t.submittedCount}</span>
          </div>
          {!session.open && (
            <p className="note w-fit text-base!">{t.collectionClosed}</p>
          )}
        </div>
        <div className="flex justify-center lg:justify-end">
          <div className="w-full rounded-[28px] max-w-[min(80vh,560px)] bg-white p-8 shadow-[0_40px_120px_-40px_rgba(99,232,198,0.6)]">
            <Qr value={url} className="aspect-square w-full" />
          </div>
        </div>
      </div>
    </main>
  );
}
