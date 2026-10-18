"use client";

/* eslint-disable @next/next/no-img-element -- photos come from many publisher domains */
import { useState } from "react";

import { TOPICS } from "@/lib/format";

// Each topic gets its own fallback colour so a missing photo still looks designed.
const TOPIC_TINT: Record<string, string> = {
  ai: "from-orange-500/25 to-rose-500/10",
  tech: "from-sky-500/25 to-indigo-500/10",
  dev: "from-emerald-500/25 to-teal-500/10",
  startups: "from-amber-500/25 to-orange-500/10",
  security: "from-red-500/25 to-zinc-500/10",
  markets: "from-lime-500/25 to-emerald-500/10",
  design: "from-fuchsia-500/25 to-violet-500/10",
};

type Props = {
  src?: string | null;
  credit?: string | null;
  topic: string;
  headline: string;
  size?: "lead" | "standard" | "thumb";
};

/**
 * The publisher's own preview photo, shown from their site with a credit.
 * No photo, or it fails to load: a branded card instead.
 */
export function StoryImage({ src, credit, topic, headline, size = "standard" }: Props) {
  const [failed, setFailed] = useState(false);
  const ratio = size === "thumb" ? "aspect-square" : size === "lead" ? "aspect-[16/9]" : "aspect-[16/10]";
  const radius = size === "thumb" ? "rounded-lg" : "rounded-xl";

  if (!src || failed) {
    return (
      <div
        className={`${ratio} ${radius} relative flex items-end overflow-hidden border border-line bg-gradient-to-br ${TOPIC_TINT[topic] ?? TOPIC_TINT.tech} p-3`}
        aria-hidden
      >
        {size !== "thumb" && (
          <span className="line-clamp-3 font-serif text-lg leading-snug font-semibold text-ink/80">{headline}</span>
        )}
        <span
          className={`absolute font-mono tracking-wide text-ink/60 uppercase ${
            size === "thumb" ? "inset-0 flex items-center justify-center text-[10px] font-bold" : "top-2 left-2 text-[10px]"
          }`}
        >
          {TOPICS[topic] ?? topic}
        </span>
      </div>
    );
  }

  return (
    <figure className="m-0">
      <img
        src={src}
        alt=""
        loading={size === "lead" ? "eager" : "lazy"}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={`${ratio} ${radius} w-full border border-line bg-sunk object-cover`}
      />
      {credit && size !== "thumb" && (
        <figcaption className="mt-1 text-[11px] text-muted">Image: {credit}</figcaption>
      )}
    </figure>
  );
}
