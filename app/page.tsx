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
      <SiteHeader
        right={
          <Link href="/admin" className="btn btn-secondary btn-sm">
            Lektor
          </Link>
        }
      />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-5 px-5 py-12">
        {/* Shared entry point for Czech and English workshops, so it shows both. */}
        <h1 className="anim-rise font-display text-4xl leading-tight font-extrabold">
          Kód <span className="text-mint">workshopu</span>
          <span className="mt-1 block text-lg font-semibold text-muted" lang="en">
            Workshop code
          </span>
        </h1>
        <form
          className="anim-rise flex gap-3 [animation-delay:80ms]"
          onSubmit={(e) => {
            e.preventDefault();
            if (clean) router.push(`/s/${clean}`);
          }}
        >
          <input
            className="input font-display text-xl font-bold tracking-[0.3em] uppercase"
            placeholder="ABC12"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoCapitalize="characters"
            autoComplete="off"
            autoFocus
            maxLength={10}
            aria-label="Kód workshopu / Workshop code"
          />
          <button className="btn shrink-0 px-6" disabled={!clean}>
            Vstoupit · Enter
          </button>
        </form>
      </main>
    </div>
  );
}
