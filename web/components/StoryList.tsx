"use client";

import { useState } from "react";

import { TOPICS, type Story } from "@/lib/format";
import { StoryCard } from "./StoryCard";

type Props = {
  stories: Story[];
  now: number;
  sortable?: boolean; // show the Top / Recent switch (feed page)
};

export function StoryList({ stories, now, sortable = false }: Props) {
  const [topic, setTopic] = useState<string | null>(null);
  const [order, setOrder] = useState<"top" | "recent">("top");

  const counts = new Map<string, number>();
  for (const s of stories) counts.set(s.topic, (counts.get(s.topic) ?? 0) + 1);
  const topicsToday = Object.keys(TOPICS).filter((t) => counts.has(t));

  const filtered = topic ? stories.filter((s) => s.topic === topic) : stories;
  const shown =
    order === "recent"
      ? [...filtered].sort((a, b) => Date.parse(b.published) - Date.parse(a.published))
      : filtered;

  return (
    <>
      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {topicsToday.length > 1 && (
          <div role="toolbar" aria-label="Filter by topic" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            <Chip label="All" count={sortable ? stories.length : undefined} active={topic === null} onClick={() => setTopic(null)} />
            {topicsToday.map((t) => (
              <Chip
                key={t}
                label={TOPICS[t]}
                count={sortable ? counts.get(t) : undefined}
                active={topic === t}
                onClick={() => setTopic(t)}
              />
            ))}
          </div>
        )}
        {sortable && (
          <div role="group" aria-label="Sort stories" className="flex shrink-0 gap-1 self-start rounded-full border border-line bg-card p-0.5 text-sm">
            {(["top", "recent"] as const).map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => setOrder(o)}
                aria-pressed={order === o}
                className={`rounded-full px-3 py-0.5 ${order === o ? "bg-ink text-paper" : "text-muted hover:text-ink"}`}
              >
                {o === "top" ? "Top" : "Recent"}
              </button>
            ))}
          </div>
        )}
      </div>
      <div>
        {shown.map((story) => (
          <StoryCard
            key={story.story_key ?? story.headline}
            story={story}
            rank={stories.indexOf(story) + 1}
            now={now}
          />
        ))}
      </div>
    </>
  );
}

function Chip({ label, count, active, onClick }: { label: string; count?: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1 text-sm whitespace-nowrap transition-colors ${
        active ? "border-ink bg-ink text-paper" : "border-line bg-card text-muted hover:border-ink hover:text-ink"
      }`}
    >
      {label}
      {count !== undefined && <span className="ml-1.5 opacity-60 tabular-nums">{count}</span>}
    </button>
  );
}
