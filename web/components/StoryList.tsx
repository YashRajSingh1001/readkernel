"use client";

import { useState } from "react";

import type { Story } from "@/lib/format";
import { StoryCard } from "./StoryCard";

export function StoryList({ stories, now }: { stories: Story[]; now: number }) {
  const [order, setOrder] = useState<"top" | "recent">("top");
  const shown =
    order === "recent" ? [...stories].sort((a, b) => Date.parse(b.published) - Date.parse(a.published)) : stories;
  const [first, ...rest] = shown;

  return (
    <>
      <div role="group" aria-label="Sort stories" className="mb-4 inline-flex gap-1 rounded-full border border-line bg-card p-0.5 text-sm">
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
      {first && <StoryCard story={first} now={now} variant="lead" rank={stories.indexOf(first) + 1} />}
      <div>
        {rest.map((story) => (
          <StoryCard key={story.story_key ?? story.headline} story={story} now={now} rank={stories.indexOf(story) + 1} />
        ))}
      </div>
    </>
  );
}
