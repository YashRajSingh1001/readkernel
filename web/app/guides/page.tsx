import type { Metadata } from "next";

import { EntryList } from "@/components/ContentPages";
import { listEntries } from "@/lib/content";

export const metadata: Metadata = {
  title: "Guides",
  description: "Practical walkthroughs for following tech and AI news without the overload.",
};

export default async function Page() {
  return (
    <EntryList
      title="Guides to keeping up"
      intro="Practical walkthroughs for following tech and AI news without the overload."
      base="/guides"
      entries={await listEntries("guides")}
    />
  );
}
