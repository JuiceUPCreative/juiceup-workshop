"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SiteHeader } from "@/components/Logo";

export default function Home() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, "");

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 px-5 py-12 sm:px-8 lg:grid-cols-2 lg:gap-16">
        <div className="flex flex-col gap-6">
          <span className="eyebrow anim-rise">JuiceUP · Workshop space</span>
          <h1 className="anim-rise font-display text-5xl leading-[1.04] font-extrabold [animation-delay:60ms] sm:text-7xl">
            Prostor pro
            <br />
            <span className="text-mint">váš pohled.</span>
          </h1>
          <p className="anim-rise max-w-lg text-lg leading-relaxed text-muted [animation-delay:120ms]">
            Otázky, které otevírají diskusi. Odpovědi, které pomáhají zjistit, na co se společně zaměřit.
          </p>
          <form
            className="anim-rise mt-2 flex max-w-md flex-col gap-3 [animation-delay:180ms]"
            onSubmit={(e) => {
              e.preventDefault();
              if (clean) router.push(`/s/${clean}`);
            }}
          >
            <label className="label" htmlFor="code" style={{ marginBottom: 0 }}>
              Jste na workshopu? Naskenujte QR kód od lektora, nebo zadejte kód.
            </label>
            <div className="flex gap-3">
              <input
                id="code"
                className="input font-display text-xl font-bold tracking-[0.3em] uppercase"
                placeholder="KÓD"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoCapitalize="characters"
                autoComplete="off"
                maxLength={10}
              />
              <button className="btn shrink-0 px-6" disabled={!clean}>
                Vstoupit ↗
              </button>
            </div>
          </form>
        </div>

        <div className="hero-card anim-rise flex flex-col gap-5 p-8 [animation-delay:240ms] sm:p-11">
          <span className="eyebrow text-ink!">Pro lektory</span>
          <h2 className="font-display text-3xl leading-tight font-extrabold sm:text-4xl">
            Méně domněnek.
            <br />
            Více porozumění.
          </h2>
          <p className="max-w-md text-lg leading-relaxed text-[#374e46]">
            Připravte otázky, pozvěte skupinu a zjistěte, co jí jde a co si zaslouží další pozornost.
          </p>
          <Link
            href="/admin"
            className="btn btn-secondary w-fit text-ink! shadow-[inset_0_0_0_1.5px_var(--ju-ink)]! hover:bg-ink/10!"
          >
            Vstoupit do administrace ↗
          </Link>
        </div>
      </main>
    </div>
  );
}
