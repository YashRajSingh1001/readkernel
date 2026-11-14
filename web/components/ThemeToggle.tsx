"use client";

import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark" | "system";
const KEY = "readkernel:theme";
const ORDER: Theme[] = ["light", "dark", "system"];

function current(): Theme {
  const value = document.documentElement.dataset.theme;
  return value === "dark" || value === "system" ? value : "light";
}

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, current, () => "light" as Theme);
  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
  const label = { light: "Light", dark: "Dark", system: "Auto" }[theme];

  function cycle() {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
    }
  }

  return (
    <button
      type="button"
      onClick={cycle}
      title={`Theme: ${label}. Switch to ${next}.`}
      aria-label={`Theme: ${label}. Switch to ${next}.`}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-sunk hover:text-ink"
    >
      {theme === "light" && (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      )}
      {theme === "dark" && (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
      {theme === "system" && (
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <rect x="3" y="4" width="18" height="12" rx="2" />
          <path d="M8 20h8M12 16v4" />
        </svg>
      )}
    </button>
  );
}

export const THEME_SCRIPT = `try{var t=localStorage.getItem('${KEY}');document.documentElement.dataset.theme=(t==='dark'||t==='system')?t:'light'}catch(e){document.documentElement.dataset.theme='light'}`;
