import type { Metadata } from "next";

import { EntryList } from "@/components/ContentPages";
import { listEntries } from "@/lib/content";

export const metadata: Metadata = {
  title: "Newsletter reviews",
  description: "What each one covers, how often it arrives, what it costs, and who it suits. Our own opinions, checked against each newsletter's website.",
};

export default async function Page() {
  return (
    <EntryList
      title="Tech newsletters, honestly reviewed"
      intro="What each one covers, how often it arrives, what it costs, and who it suits. Our own opinions, checked against each newsletter's website."
      base="/newsletters"
      entries={await listEntries("newsletters")}
    />
  );
}
