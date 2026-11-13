"use client";

/* eslint-disable @next/next/no-img-element -- publisher photos, as they appear in the email */
import { TOPICS, formatDate, readingMinutes, type Story } from "@/lib/format";

/** A look at the email as it will arrive, built from today's real stories. */
export function EmailPreview({ stories, format, date, weekly }: { stories: Story[]; format: string; date: string; weekly: boolean }) {
  const minutes = readingMinutes(format === "headlines" ? [] : stories);
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white text-[#17150f] shadow-sm">
      <div className="flex items-center justify-between border-b border-[#e6e3dc] px-5 py-3 text-[11px] text-[#66625a]">
        <span>PREVIEW · {weekly ? "THIS WEEK" : formatDate(date).toUpperCase()}</span>
        <span>≈ {format === "headlines" ? 1 : minutes} min read</span>
      </div>
      <div className="max-h-[70vh] overflow-y-auto px-5 py-5">
        <p className="text-lg">
          read<span className="font-bold">kernel</span>
          <span className="text-[#c2410c]">.</span>
        </p>
        <p className="mt-3 text-xs font-semibold text-[#0f766e]">{weekly ? "This week" : "Today's brief"}</p>
        <p className="text-sm text-[#66625a]">{stories.length} stories worth your time.</p>
        {stories.length === 0 && (
          <p className="mt-6 rounded-lg bg-[#f3f1ec] p-4 text-sm text-[#66625a]">
            No stories in these topics today. Pick more topics, or keep them: on quiet days you&apos;ll get fewer.
          </p>
        )}
        <ol className="mt-4 space-y-5">
          {stories.map((s, i) => (
            <li key={s.story_key ?? s.headline} className="border-t border-[#e6e3dc] pt-4">
              <p className="text-xs font-bold text-[#c2410c]">
                {i + 1}. {TOPICS[s.topic] ?? s.topic}
              </p>
              {format === "images" && s.image_url && (
                <img src={s.image_url} alt="" referrerPolicy="no-referrer" loading="lazy" className="mt-2 aspect-[16/9] w-full rounded-lg object-cover" />
              )}
              <p className="mt-1 font-serif text-lg leading-snug font-bold">{s.headline}</p>
              {format !== "headlines" && s.summary && <p className="mt-1 text-sm leading-relaxed">{s.summary}</p>}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
