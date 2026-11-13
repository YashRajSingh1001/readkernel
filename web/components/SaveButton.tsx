"use client";

import { toggleSaved, useSaved, type SavedStory } from "@/lib/saved";

export function SaveButton({ story }: { story: Omit<SavedStory, "savedAt"> }) {
  const saved = useSaved().some((s) => s.key === story.key);
  return (
    <button
      type="button"
      onClick={() => toggleSaved(story)}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved" : "Save story"}
      title={saved ? "Remove from saved" : "Save for later"}
      className={`rk-save inline-flex min-w-[4.25rem] items-center gap-1 rounded-md border px-2 py-1 text-xs ${
        saved ? "border-accent bg-accent-soft text-accent" : "border-line bg-card text-muted hover:border-ink hover:text-ink"
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M6 3h12v18l-6-4-6 4z" strokeLinejoin="round" />
      </svg>
      {saved ? "Saved" : "Save"}
    </button>
  );
}
