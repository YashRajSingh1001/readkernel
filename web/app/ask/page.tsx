import type { Metadata } from "next";
import { Suspense } from "react";

import { AskChat } from "@/components/AskChat";
import { Container } from "@/components/Container";
import { getStory } from "@/lib/brief";

export const metadata: Metadata = {
  title: "Ask ReadKernel",
  description: "Ask anything about tech and AI news. ReadKernel searches its archive and answers with a link for every fact.",
};

export default function AskPage({ searchParams }: PageProps<"/ask">) {
  return (
    <Container>
      <h1 className="text-4xl title-sans">Ask the news</h1>
      <p className="mt-2 mb-8 text-muted">
        Ask about any company, product or story. ReadKernel searches everything it has covered, follows the story over
        time, and answers with a link for every fact. It only knows what it has covered, so very new or niche topics may
        be missing.
      </p>
      <Suspense fallback={<AskChat />}>
        <AskForStory searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}

// /ask?story=<key> (the "Ask about this story" button): the chat starts focused on that story.
async function AskForStory({ searchParams }: { searchParams: PageProps<"/ask">["searchParams"] }) {
  const { story: key } = await searchParams;
  const story = typeof key === "string" ? await getStory(key) : null;
  return <AskChat story={story?.story_key ? { key: story.story_key, headline: story.headline } : undefined} />;
}
