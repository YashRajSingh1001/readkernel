"use client";

import { useActionState } from "react";

import { subscribeAction, type FormState } from "@/app/actions";

export function SignupForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(subscribeAction, null);

  return (
    <section className="mb-8 rounded-xl border border-line bg-card p-4 sm:p-5">
      <h2 className="font-serif text-lg font-semibold">Get the brief in your inbox</h2>
      <p className="mt-1 text-sm text-muted">One email each morning. Free. Unsubscribe with one click.</p>

      {state?.ok ? (
        <p role="status" className="mt-3 text-sm font-medium text-accent">{state.message}</p>
      ) : (
        <form action={action} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <label htmlFor="signup-email" className="sr-only">Email address</label>
          <input
            id="signup-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-3 py-2 text-base outline-none focus:border-ink"
          />
          {/* Honeypot: hidden from people, filled in by bots */}
          <input type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-ink px-4 py-2 font-medium text-paper hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Signing up…" : "Subscribe"}
          </button>
        </form>
      )}
      {state && !state.ok && (
        <p role="alert" className="mt-2 text-sm text-accent">{state.message}</p>
      )}
    </section>
  );
}
