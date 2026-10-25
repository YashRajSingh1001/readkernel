"use client";

/* eslint-disable @next/next/no-img-element -- photos come from many publisher domains */
import { useState } from "react";

import { TOPICS, faviconUrl } from "@/lib/format";

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
  /** Lead source, shown on the no-photo card. */
  sourceName?: string;
  sourceUrl?: string;
};

/**
 * The publisher's own preview photo, shown from their site with a credit.
 * No photo (some publishers block automated visits), or it fails to load: a
 * compact branded card with the topic and the publisher instead.
 */
export function StoryImage({ src, credit, topic, headline, size = "standard", sourceName, sourceUrl }: Props) {
  const [failed, setFailed] = useState(false);
  const ratio = size === "thumb" ? "aspect-square" : size === "lead" ? "aspect-[16/9]" : "aspect-[16/10]";
  const radius = size === "thumb" ? "rounded-lg" : "rounded-xl";
  const tint = TOPIC_TINT[topic] ?? TOPIC_TINT.tech;
  const label = TOPICS[topic] ?? topic;

  if (!src || failed) {
    if (size === "thumb") {
      return (
        <div className={`${ratio} ${radius} flex items-center justify-center border border-line bg-gradient-to-br ${tint}`} aria-hidden>
          <span className="font-mono text-[10px] font-bold tracking-wide text-ink/60 uppercase">{label}</span>
        </div>
      );
    }
    // Shorter than a photo so a missing image doesn't leave a big empty box.
    return (
      <div
        className={`${size === "lead" ? "aspect-[3/1]" : "aspect-[16/10] sm:aspect-[16/10]"} ${radius} relative flex flex-col justify-between overflow-hidden border border-line bg-gradient-to-br ${tint} p-4`}
        aria-label={headline}
        role="img"
      >
        <span className="font-mono text-xs font-bold tracking-widest text-ink/70 uppercase">{label}</span>
        <span className="absolute -right-2 -bottom-6 font-serif text-[7rem] leading-none font-bold text-ink/[0.06] select-none" aria-hidden>
          {label}
        </span>
        {sourceName && (
          <span className="relative flex items-center gap-2 text-sm font-medium text-ink/80">
            {sourceUrl && (
              <img src={faviconUrl(sourceUrl)} alt="" width={20} height={20} loading="lazy" referrerPolicy="no-referrer" className="h-5 w-5 rounded bg-card" />
            )}
            {sourceName}
          </span>
        )}
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
