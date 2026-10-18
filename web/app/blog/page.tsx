import type { Metadata } from "next";

import { EntryList } from "@/components/ContentPages";
import { listEntries } from "@/lib/content";

export const metadata: Metadata = {
  title: "Blog",
  description: "How we build ReadKernel, how we pick stories, and how to keep up with tech without losing your morning.",
};

export default async function Page() {
  return (
    <EntryList
      label="Blog"
      title="Notes from ReadKernel"
      intro="How we build ReadKernel, how we pick stories, and how to keep up with tech without losing your morning."
      base="/blog"
      entries={await listEntries("blog")}
    />
  );
}
