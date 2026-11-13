"use client";

/* eslint-disable @next/next/no-img-element -- photos come from many publisher domains */
import { useState } from "react";

import { TOPICS, faviconUrl } from "@/lib/format";

type Props = {
  src?: string | null;
  credit?: string | null;
  topic: string;
  headline: string;
  size?: "lead" | "standard" | "thumb";
  /** Text on the no-photo card; defaults to the topic name. */
  label?: string;
  /** Lead source, shown on the no-photo card. */
  sourceName?: string;
  sourceUrl?: string;
};

/**
 * The publisher's own preview photo, shown from their site with a credit.
 * No photo (some publishers block automated visits), or it fails to load: a
 * compact branded card with the topic and the publisher instead.
 */
export function StoryImage({ src, credit, topic, headline, size = "standard", sourceName, sourceUrl, label: labelText }: Props) {
  const [failed, setFailed] = useState(false);
  const ratio = size === "thumb" ? "aspect-square" : size === "lead" ? "aspect-[16/9]" : "aspect-[16/10]";
  const radius = size === "thumb" ? "rounded" : "rounded-md";
  const label = labelText ?? TOPICS[topic] ?? topic;

  if (!src || failed) {
    if (size === "thumb") {
      return (
        <div className={`${ratio} ${radius} flex items-center justify-center border border-line bg-sunk`} aria-hidden>
          <span className="text-[11px] font-semibold text-muted">{label}</span>
        </div>
      );
    }
    // Shorter than a photo so a missing image doesn't leave a big empty box.
    return (
      <div
        className={`${size === "lead" ? "aspect-[3/1]" : "aspect-[16/10] sm:aspect-[16/10]"} ${radius} flex flex-col justify-between border border-line bg-sunk p-4`}
        aria-label={headline}
        role="img"
      >
        <span className="text-sm font-semibold text-muted">{label}</span>
        {sourceName && (
          <span className="flex items-center gap-2 text-sm font-medium text-ink">
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
