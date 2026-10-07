"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Drop, Logo } from "@/components/Logo";

export default function Home() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, "");

  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-2xl flex-col overflow-hidden px-5">
      <header className="flex items-center justify-between pt-5">
        <Logo className="h-6 w-auto" />
        <Link href="/admin" className="text-sm font-semibold text-muted hover:text-ink">
          Lektor
        </Link>
      </header>

      <Drop className="anim-float pointer-events-none absolute top-24 -right-6 h-40 w-32 text-mint/60" />
      <Drop className="anim-float pointer-events-none absolute bottom-16 -left-4 h-16 w-12 text-pink/60 [animation-delay:-3s]" />

      <div className="relative flex flex-1 flex-col justify-center gap-8 py-12">
        <h1 className="anim-rise font-display text-5xl leading-[1.02] font-extrabold sm:text-6xl">
          Připoj se
          <br />
          k <span className="text-mint-strong">workshopu</span>
        </h1>
        <p className="anim-rise max-w-md text-lg text-ink/70 [animation-delay:80ms]">
          Naskenuj QR kód z prezentace, nebo zadej kód, který ti dal lektor.
        </p>
        <form
          className="anim-rise flex max-w-md flex-col gap-3 sm:flex-row [animation-delay:160ms]"
          onSubmit={(e) => {
            e.preventDefault();
            if (clean) router.push(`/s/${clean}`);
          }}
        >
          <input
            className="input font-display text-center text-2xl font-bold tracking-[0.3em] uppercase sm:text-left"
            placeholder="KÓD"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoCapitalize="characters"
            autoComplete="off"
            maxLength={10}
            aria-label="Kód workshopu"
          />
          <button className="btn btn-dark shrink-0 px-8" disabled={!clean}>
            Vstoupit →
          </button>
        </form>
      </div>
    </main>
  );
}
