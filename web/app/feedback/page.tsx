import type { Metadata } from "next";
import { Suspense } from "react";

import { FeedbackShell, RatingFeedback, StoryReport } from "@/components/FeedbackForm";
import { getStory } from "@/lib/brief";
import { parseFeedback } from "@/lib/feedback";
import { adminConfigured } from "@/lib/server/admin-db";

export const metadata: Metadata = { title: "Feedback", robots: { index: false } };

export default function FeedbackPage({ searchParams }: PageProps<"/feedback">) {
  return (
    <Suspense>
      <Feedback searchParams={searchParams} />
    </Suspense>
  );
}

async function Feedback({ searchParams }: { searchParams: PageProps<"/feedback">["searchParams"] }) {
  const { d, r, t, story } = await searchParams;
  if (!adminConfigured()) {
    return (
      <FeedbackShell title="Feedback">
        <p className="mt-4 text-muted">Feedback isn&apos;t available on this server right now.</p>
      </FeedbackShell>
    );
  }

  if (typeof story === "string") {
    const found = await getStory(story);
    if (!found) {
      return (
        <FeedbackShell title="Report a mistake">
          <p className="mt-4 text-muted">We couldn&apos;t find that story.</p>
        </FeedbackShell>
      );
    }
    return <StoryReport storyKey={story} date={found.edition_date} headline={found.headline} />;
  }

  const rating = parseFeedback({ kind: "brief_rating", date: d, rating: r, token: t });
  if (rating?.kind !== "brief_rating") {
    return (
      <FeedbackShell title="Feedback">
        <p className="mt-4 text-muted">This link isn&apos;t complete. Please use the link from your email.</p>
      </FeedbackShell>
    );
  }
  return <RatingFeedback date={rating.date} rating={rating.rating} token={rating.token} />;
}
