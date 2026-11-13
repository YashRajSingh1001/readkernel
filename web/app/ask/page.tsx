import type { Metadata } from "next";

import { AskChat } from "@/components/AskChat";
import { Container } from "@/components/Container";

export const metadata: Metadata = {
  title: "Ask ReadKernel",
  description: "Ask anything about tech and AI news. ReadKernel searches its archive and answers with a link for every fact.",
};

export default function AskPage() {
  return (
    <Container>
      <p className="text-sm font-semibold text-label">Ask ReadKernel</p>
      <h1 className="mt-1 text-4xl font-extrabold tracking-tight">Ask the news</h1>
      <p className="mt-2 mb-8 text-muted">
        Ask about any company, product or story. ReadKernel searches everything it has covered, follows the story over
        time, and answers with a link for every fact. It only knows what it has covered, so very new or niche topics may
        be missing.
      </p>
      <AskChat />
    </Container>
  );
}
