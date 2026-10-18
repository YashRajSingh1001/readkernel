import type { Metadata } from "next";

import { SavedList } from "@/components/SavedList";

export const metadata: Metadata = { title: "Saved", robots: { index: false } };

export default function SavedPage() {
  return (
    <>
      <p className="text-sm font-medium tracking-wide text-accent uppercase">Saved</p>
      <h1 className="mt-1 mb-2 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">Your reading list</h1>
      <p className="mb-6 text-sm text-muted">
        Saved on this device only. No account needed, and nothing is sent to us.
      </p>
      <SavedList />
    </>
  );
}
