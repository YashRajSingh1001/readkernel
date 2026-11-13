import type { Metadata } from "next";

import { Builder } from "@/components/Builder";
import { Container } from "@/components/Container";
import { getLatestEdition } from "@/lib/brief";

export const metadata: Metadata = {
  title: "Build your brief",
  description: "Pick your topics, how many stories and how you read them. The preview is today's real email.",
};

export default async function CustomizePage() {
  const edition = await getLatestEdition();
  return (
    <Container size="wide">
      <h1 className="text-4xl title-sans">Build your brief</h1>
      <p className="mt-2 mb-8 max-w-2xl text-muted">
        Choose your topics, length and format. The preview on the right is today&apos;s real email, built from your
        picks as you click.
      </p>
      {edition ? <Builder edition={edition} /> : <p className="text-muted">The first edition isn&apos;t out yet.</p>}
    </Container>
  );
}
