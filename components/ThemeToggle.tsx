"use client";

import { useSyncExternalStore } from "react";

type Theme = "dark" | "light";
const KEY = "jw-theme";

/** Runs before first paint (inlined in <head>) so the stored theme never flashes. */
export const themeInitScript = `try{if(localStorage.getItem("${KEY}")==="light")document.documentElement.dataset.theme="light"}catch(e){}`;

function current(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

export function ThemeToggle() {
  const theme = useSyncExternalStore<Theme>(subscribe, current, () => "dark");
  const next: Theme = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => {
        if (next === "light") document.documentElement.dataset.theme = "light";
        else delete document.documentElement.dataset.theme;
        try {
          localStorage.setItem(KEY, next);
        } catch {}
      }}
      aria-label={next === "light" ? "Přepnout na světlý režim" : "Přepnout na tmavý režim"}
      title={next === "light" ? "Světlý režim" : "Tmavý režim"}
      className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-line hover:text-paper"
    >
      <span key={theme} className="anim-pop grid place-items-center">
        {theme === "light" ? (
          // Moon: switches to dark mode
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
            <path d="M20.5 14.6A8.5 8.5 0 0 1 9.4 3.5a.6.6 0 0 0-.8-.7A9.5 9.5 0 1 0 21.2 15.4a.6.6 0 0 0-.7-.8Z" />
          </svg>
        ) : (
          // Sun: switches to light mode
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden
          >
            <circle cx="12" cy="12" r="4.2" fill="currentColor" stroke="none" />
            <path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
          </svg>
        )}
      </span>
    </button>
  );
}
