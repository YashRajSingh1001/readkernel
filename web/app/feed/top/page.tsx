import type { Metadata } from "next";

import { formatDate, getLatestEdition } from "@/lib/brief";

export const metadata: Metadata = {
  title: "Top articles",
  description: "The posts developers are discussing most today, from Hacker News, with a one-line summary each.",
};

export default async function TopArticlesPage() {
  const edition = await getLatestEdition();
  const items = edition?.discussions ?? [];

  return (
    <>
      <header className="mb-6">
        <h1 className="text-4xl title-serif">
          What developers are discussing{" "}
          <span className="font-sans text-lg font-normal text-muted tabular-nums">{items.length}</span>
        </h1>
        <p className="mt-2 text-muted">
          {edition && <span className="font-semibold text-ink">{formatDate(edition.date)}.</span>}{" "}
          The most-upvoted posts on Hacker News in the last day and a half.</p>
      </header>

      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-line p-8 text-center text-muted">Nothing yet today.</p>
      ) : (
        <ol className="divide-y divide-line border-y border-line">
          {items.map((d, i) => (
            <li key={d.url} className="grid grid-cols-[2.25rem_1fr] gap-3 py-4">
              <span className="pt-0.5 text-sm text-muted tabular-nums">{i + 1}</span>
              <div className="min-w-0">
                <a href={d.url} target="_blank" rel="noopener noreferrer" className="font-serif text-lg leading-snug font-semibold hover:text-accent">
                  {d.title}
                </a>
                {d.summary && <p className="mt-1 text-sm leading-relaxed text-muted">{d.summary}</p>}
                <p className="mt-1.5 flex flex-wrap gap-x-3 text-xs text-muted">
                  <span>{d.source}</span>
                  {d.points != null && <span className="text-accent">▲ {d.points} points</span>}
                  {d.comments_url && (
                    <a href={d.comments_url} target="_blank" rel="noopener noreferrer" className="hover:text-ink">
                      {d.comments ?? 0} comments
                    </a>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
