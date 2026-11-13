"use client";

import { useState } from "react";

import type { Edition } from "@/lib/format";
import { DEFAULT_PREFS, selectStories, type Prefs } from "@/lib/personal";
import { EmailPreview } from "./EmailPreview";
import { PrefsPicker } from "./PrefsPicker";
import { SignupForm } from "./SignupForm";

/** The "make it yours" page: choices on the left, today's real email on the right. */
export function Builder({ edition }: { edition: Edition }) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const stories = selectStories(edition.stories, edition.feed, prefs.topics, prefs.count);

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_420px]">
      <div>
        <PrefsPicker value={prefs} onChange={setPrefs} />
        <div className="mt-8 rounded-lg border border-line bg-sunk p-5">
          <h2 className="font-bold">Send it to me</h2>
          <p className="mt-1 mb-3 text-sm text-muted">
            We&apos;ll email you once to confirm. Already subscribed? We&apos;ll send you a link to update your settings
            instead.
          </p>
          <SignupForm compact prefs={prefs} buttonLabel="Save my brief" />
        </div>
      </div>
      <div className="lg:sticky lg:top-20 lg:self-start">
        <EmailPreview stories={stories} format={prefs.format} date={edition.date} weekly={prefs.frequency === "weekly"} />
      </div>
    </div>
  );
}
