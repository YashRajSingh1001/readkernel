"use client";

import { useActionState } from "react";

import { subscribeAction, type FormState } from "@/app/actions";
import type { Prefs } from "@/lib/personal";

type Props = {
  /** Smaller card used inside the brief; the homepage uses the large hero form. */
  compact?: boolean;
  /** "Make it yours" choices sent with the sign-up (builder page). */
  prefs?: Prefs;
  buttonLabel?: string;
};

export function SignupForm({ compact = false, prefs, buttonLabel = "Get the daily brief" }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(subscribeAction, null);

  const form = state?.ok ? (
    <p role="status" className="text-sm font-medium text-label">
      {state.message}
    </p>
  ) : (
    <form action={action} className={`flex flex-col gap-2 ${compact ? "sm:flex-row" : "sm:flex-row sm:rounded-full sm:border sm:border-line sm:bg-card sm:p-1.5 sm:shadow-sm"}`}>
      <label htmlFor={compact ? "signup-email-c" : "signup-email"} className="sr-only">
        Email address
      </label>
      <input
        id={compact ? "signup-email-c" : "signup-email"}
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="you@example.com"
        className={`min-w-0 flex-1 bg-card px-4 py-2.5 text-base outline-none ${
          compact ? "rounded-lg border border-line focus:border-ink" : "rounded-full border border-line focus:border-ink sm:border-0"
        }`}
      />
      {/* Honeypot: hidden from people, filled in by bots */}
      <input type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      {prefs && (
        <>
          <input type="hidden" name="topics" value={prefs.topics.join(",")} />
          <input type="hidden" name="story_count" value={prefs.count} />
          <input type="hidden" name="format" value={prefs.format} />
          <input type="hidden" name="frequency" value={prefs.frequency} />
          <input type="hidden" name="companyRead" value={prefs.companyRead ? "1" : "0"} />
        </>
      )}
      <button
        type="submit"
        disabled={pending}
        className={`bg-accent px-5 py-2.5 font-semibold text-white hover:opacity-90 disabled:opacity-60 ${compact ? "rounded-lg" : "rounded-full"}`}
      >
        {pending ? "Signing up…" : `${buttonLabel} →`}
      </button>
    </form>
  );

  return (
    <div className={compact ? "rounded-xl border border-line bg-card p-4 sm:p-5" : ""}>
      {compact && (
        <>
          <h2 className="font-serif text-lg font-semibold">Get this in your inbox</h2>
          <p className="mt-1 mb-3 text-sm text-muted">One email each morning at 6 AM IST. Free. Unsubscribe with one click.</p>
        </>
      )}
      {form}
      {state && !state.ok && (
        <p role="alert" className="mt-2 text-sm text-accent">
          {state.message}
        </p>
      )}
    </div>
  );
}
