"use client";

import { useState } from "react";

import { TOPICS, type Story } from "@/lib/format";
import { StoryCard } from "./StoryCard";

export function StoryList({ stories, now }: { stories: Story[]; now: number }) {
  const [topic, setTopic] = useState<string | null>(null);
  const topicsToday = Object.keys(TOPICS).filter((t) => stories.some((s) => s.topic === t));
  const shown = topic ? stories.filter((s) => s.topic === topic) : stories;

  return (
    <>
      {topicsToday.length > 1 && (
        <div
          role="toolbar"
          aria-label="Filter by topic"
          className="-mx-4 mb-2 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0"
        >
          <Chip label="All" active={topic === null} onClick={() => setTopic(null)} />
          {topicsToday.map((t) => (
            <Chip key={t} label={TOPICS[t]} active={topic === t} onClick={() => setTopic(t)} />
          ))}
        </div>
      )}
      <div>
        {shown.map((story) => (
          <StoryCard key={story.headline} story={story} rank={stories.indexOf(story) + 1} now={now} />
        ))}
      </div>
    </>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1 text-sm whitespace-nowrap transition-colors ${
        active
          ? "border-ink bg-ink text-paper"
          : "border-line bg-card text-muted hover:border-ink hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}
