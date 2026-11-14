import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { FeedView } from "@/components/FeedView";
import { TOPICS, TOPIC_BLURBS, getLatestEdition, previousEditionDate } from "@/lib/brief";

export function generateStaticParams() {
  return Object.keys(TOPICS).map((topic) => ({ topic }));
}

export async function generateMetadata({ params }: PageProps<"/feed/[topic]">): Promise<Metadata> {
  const { topic } = await params;
  if (!TOPICS[topic]) return {};
  return { title: `${TOPICS[topic]} news today`, description: TOPIC_BLURBS[topic] };
}

export default function TopicFeedPage({ params }: PageProps<"/feed/[topic]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <TopicFeed params={params} />
    </Suspense>
  );
}

async function TopicFeed({ params }: { params: PageProps<"/feed/[topic]">["params"] }) {
  const { topic } = await params;
  if (!TOPICS[topic]) notFound();
  const edition = await getLatestEdition();
  if (!edition) return <p className="py-16 text-center text-muted">No stories yet.</p>;
  return <FeedView edition={edition} topic={topic} olderDate={await previousEditionDate(edition.date)} />;
}
