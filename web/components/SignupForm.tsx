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
  /** Field above button at every width (narrow side columns). */
  stacked?: boolean;
};

export function SignupForm({ compact = false, prefs, buttonLabel = "Get the daily brief", stacked = false }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(subscribeAction, null);

  // The status region is always mounted (empty until success) so screen readers reliably
  // announce the confirmation; the confirmation fades in where the form was.
  const status = (
    <div role="status">
      {state?.ok && (
        <div className="rk-arrive">
          <p className="font-serif text-lg font-semibold text-ink">Check your inbox.</p>
          <p className="mt-0.5 text-sm text-muted">{state.message}</p>
        </div>
      )}
    </div>
  );
  // Hold the form's height (two rows when stacked or on phones, one row otherwise) so the
  // page doesn't jump when the confirmation replaces it.
  const reserve = stacked ? "min-h-[6.25rem]" : "min-h-[6.25rem] sm:min-h-[2.75rem]";

  const form = state?.ok ? null : (
    <form action={action} className={`flex flex-col gap-2 ${stacked ? "" : "sm:flex-row"}`}>
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
          "rounded-md border border-line focus:border-ink"
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
        className={`bg-accent px-5 py-2.5 font-semibold text-paper hover:opacity-90 disabled:opacity-60 rounded-md`}
      >
        {pending ? "Signing up…" : buttonLabel}
      </button>
    </form>
  );

  return (
    <div className={compact ? "border-y border-line py-5" : ""}>
      {compact && (
        <>
          <h2 className="font-serif text-lg font-semibold">Get this in your inbox</h2>
          <p className="mt-1 mb-3 text-sm text-muted">One email each morning at 6 AM IST. Free. Unsubscribe with one click.</p>
        </>
      )}
      <div className={reserve}>
        {status}
        {form}
      </div>
      {state && !state.ok && (
        <p role="alert" className="mt-2 text-sm text-accent">
          {state.message}
        </p>
      )}
    </div>
  );
}
