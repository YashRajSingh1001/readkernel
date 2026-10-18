"use client";

import Link from "next/link";

import { TOPICS } from "@/lib/format";
import { toggleSaved, useSaved } from "@/lib/saved";

export function SavedList() {
  const saved = useSaved();

  if (saved.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line p-8 text-center text-muted">
        Nothing saved yet. Tap <span className="font-medium text-ink">Save</span> on any story and it shows up here.
        <div className="mt-4">
          <Link href="/feed" className="text-accent hover:underline">Browse the feed</Link>
        </div>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-line border-y border-line">
      {saved.map((s) => (
        <li key={s.key} className="flex items-start gap-3 py-4">
          <div className="min-w-0 flex-1">
            <div className="text-xs text-muted">
              <span className="font-medium text-accent">{TOPICS[s.topic] ?? s.topic}</span> · {s.source}
            </div>
            <Link href={`/story/${s.key}`} className="mt-1 block font-serif text-lg leading-snug font-semibold hover:text-accent">
              {s.headline}
            </Link>
          </div>
          <button
            type="button"
            onClick={() => toggleSaved(s)}
            className="shrink-0 rounded-md border border-line px-2 py-1 text-xs text-muted hover:border-ink hover:text-ink"
            aria-label={`Remove "${s.headline}" from saved`}
          >
            Remove
          </button>
        </li>
      ))}
    </ul>
  );
}
