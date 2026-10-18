import type { Metadata } from "next";
import Link from "next/link";

import { StoryList } from "@/components/StoryList";
import { formatDate, getLatestEdition } from "@/lib/brief";

export const metadata: Metadata = {
  title: "Feed",
  description: "Every story ReadKernel picked today, by topic. Sort by what matters most or what's newest.",
};

export default async function FeedPage() {
  const edition = await getLatestEdition();

  if (!edition || edition.feed.length === 0) {
    return <p className="py-16 text-center text-muted">No stories yet. Check back after the next run.</p>;
  }

  const sourceCount = new Set(edition.feed.flatMap((s) => s.sources.map((x) => x.name))).size;

  return (
    <>
      <div className="mb-6">
        <p className="text-sm font-medium tracking-wide text-accent uppercase">The feed</p>
        <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">Everything worth knowing</h1>
        <p className="mt-2 text-sm text-muted">
          {edition.feed.length} stories from {sourceCount} sources · {formatDate(edition.date)}. The top 10 make{" "}
          <Link href="/" className="text-ink underline decoration-line underline-offset-2 hover:decoration-ink">
            today&apos;s brief
          </Link>
          .
        </p>
      </div>
      <StoryList stories={edition.feed} now={Date.parse(edition.generated_at)} sortable />
      <div className="mt-8 border-t border-line pt-6 text-center">
        <Link href="/brief" className="text-sm text-muted hover:text-ink">See earlier days in the archive →</Link>
      </div>
    </>
  );
}
