import type { Metadata } from "next";
import Link from "next/link";

import { formatDate, listEditions } from "@/lib/brief";

export const metadata: Metadata = {
  title: "Archive",
  description: "Every past ReadKernel brief, day by day.",
};

export default async function Archive() {
  const editions = await listEditions();

  return (
    <>
      <p className="text-sm font-medium tracking-wide text-accent uppercase">Archive</p>
      <h1 className="mt-1 mb-6 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
        Every brief
      </h1>
      {editions.length === 0 ? (
        <p className="text-muted">No editions yet.</p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {editions.map((e) => (
            <li key={e.date}>
              <Link
                href={`/brief/${e.date}`}
                className="flex items-baseline justify-between gap-4 py-4 hover:text-accent"
              >
                <span className="font-serif text-lg">{formatDate(e.date)}</span>
                <span className="shrink-0 text-sm text-muted">{e.story_count} stories</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
