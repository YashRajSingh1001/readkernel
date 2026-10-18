"use client";

import { useEffect, useState } from "react";

// Reads the brief aloud with the browser's built-in voice (free, works offline).
export function ListenButton({ parts, label = "Listen" }: { parts: string[]; label?: string }) {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    // speechSynthesis only exists in the browser; check after mount to keep SSR and client in step.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => window.speechSynthesis?.cancel();
  }, []);

  if (!supported) return null;

  function toggle() {
    const synth = window.speechSynthesis;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    synth.cancel();
    parts.forEach((text, i) => {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.02;
      if (i === parts.length - 1) u.onend = () => setSpeaking(false);
      synth.speak(u);
    });
    setSpeaking(true);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={speaking}
      className="inline-flex items-center gap-1.5 rounded-md border border-line bg-card px-2.5 py-1 text-xs text-muted hover:border-ink hover:text-ink"
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
        {speaking ? <path d="M7 5h4v14H7zM13 5h4v14h-4z" /> : <path d="M8 5v14l11-7z" />}
      </svg>
      {speaking ? "Stop" : label}
    </button>
  );
}
