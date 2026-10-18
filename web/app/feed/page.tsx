import type { Metadata } from "next";

import { FeedView } from "@/components/FeedView";
import { getLatestEdition, previousEditionDate } from "@/lib/brief";

export const metadata: Metadata = {
  title: "Feed",
  description: "Every story ReadKernel picked today, by topic. Sort by what matters most or what's newest.",
};

export default async function FeedPage() {
  const edition = await getLatestEdition();
  if (!edition || edition.feed.length === 0) {
    return <p className="py-16 text-center text-muted">No stories yet. Check back after the next run.</p>;
  }
  return <FeedView edition={edition} olderDate={await previousEditionDate(edition.date)} />;
}
