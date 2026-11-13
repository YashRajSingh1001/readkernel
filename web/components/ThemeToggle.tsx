"use client";

import { useSyncExternalStore } from "react";

// Light or dark; light by default. The choice is stored per browser and applied
// before the page paints by the small script in the root layout (no flash).
export type Theme = "light" | "dark";
const KEY = "readkernel:theme";

function current(): Theme {
  const value = document.documentElement.dataset.theme;
  return value === "dark" ? "dark" : "light";
}

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, current, () => "light" as Theme);
  const next: Theme = theme === "light" ? "dark" : "light";
  const label = theme === "light" ? "Light" : "Dark";

  function toggle() {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // storage blocked: the choice lasts for this visit only
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
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
    </button>
  );
}

// Runs in <head> before paint. Kept as a string so it can be inlined.
export const THEME_SCRIPT = `try{var t=localStorage.getItem('${KEY}');document.documentElement.dataset.theme=t==='dark'?'dark':'light'}catch(e){document.documentElement.dataset.theme='light'}`;
