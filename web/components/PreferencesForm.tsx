"use client";

import { useActionState, useState } from "react";

import type { FormState } from "@/app/actions";
import type { Prefs } from "@/lib/personal";
import { PrefsPicker } from "./PrefsPicker";

type Props = {
  initial: Prefs;
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  token?: string; // email-link mode; signed-in mode has none
};

export function PreferencesForm({ initial, action, token }: Props) {
  const [prefs, setPrefs] = useState<Prefs>(initial);
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, null);

  return (
    <form action={formAction}>
      <PrefsPicker value={prefs} onChange={setPrefs} />
      {token && <input type="hidden" name="token" value={token} />}
      <input type="hidden" name="topics" value={prefs.topics.join(",")} />
      <input type="hidden" name="story_count" value={prefs.count} />
      <input type="hidden" name="format" value={prefs.format} />
      <input type="hidden" name="frequency" value={prefs.frequency} />
      <input type="hidden" name="companyRead" value={prefs.companyRead ? "1" : "0"} />
      <div className="mt-8 flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-accent px-6 py-2.5 font-semibold text-white hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save my brief"}
        </button>
        {state && (
          <p role="status" className={`text-sm ${state.ok ? "text-label" : "text-accent"}`}>
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
