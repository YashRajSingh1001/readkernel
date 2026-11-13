import type { Metadata } from "next";
import { Suspense } from "react";

import { AskChat } from "@/components/AskChat";
import { Container } from "@/components/Container";
import { getStory } from "@/lib/brief";

export const metadata: Metadata = {
  title: "Ask ReadKernel",
  description: "Ask anything about tech and AI news. ReadKernel searches its archive and the web, and answers with links to the sources it used.",
};

export default function AskPage({ searchParams }: PageProps<"/ask">) {
  return (
    <Container>
      {/* AskChat draws the page heading: a centred prompt before the first question, like a chat app. */}
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
