import { Container } from "@/components/Container";
import type { Metadata } from "next";

import { SavedList } from "@/components/SavedList";

export const metadata: Metadata = { title: "Saved", robots: { index: false } };

export default function SavedPage() {
  return (
    <Container>
      <p className="font-mono text-xs tracking-wide text-label uppercase">Saved</p>
      <h1 className="mt-1 mb-2 text-4xl font-extrabold tracking-tight">Your reading list</h1>
      <p className="mb-6 text-sm text-muted">
        Saved on this device only. No account needed, and nothing is sent to us.
      </p>
      <SavedList />
    </Container>
  );
}
