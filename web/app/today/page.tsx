import type { Metadata } from "next";

import { Container } from "@/components/Container";
import { EditionView } from "@/components/EditionView";
import { getLatestEdition } from "@/lib/brief";

export const metadata: Metadata = {
  title: "Today's brief",
  description: "The ten tech and AI stories that mattered today, each with a short summary and every source linked.",
};

export default async function TodayPage() {
  const edition = await getLatestEdition();
  if (!edition) {
    return (
      <Container className="py-16 text-center">
        <h1 className="text-3xl font-extrabold">No brief yet</h1>
        <p className="mt-3 text-muted">The first edition appears after the morning run.</p>
      </Container>
    );
  }
  return <EditionView edition={edition} isLatest />;
}
