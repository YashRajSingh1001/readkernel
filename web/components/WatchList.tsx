"use client";

import { useActionState, useRef } from "react";

import { addWatchAction, removeWatchAction, type FormState } from "@/app/actions";

type Props = { token: string; watches: { id: string; description: string }[]; max: number };

const EXAMPLES = ["UPI and digital payment rules in India", "Open-weight AI model releases", "Indian AI startups raising money"];

/** Plain-English watch alerts: matches show up at the top of the reader's email. */
export function WatchList({ token, watches, max }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, addAction, pending] = useActionState<FormState, FormData>(async (prev, form) => {
    const result = await addWatchAction(prev, form);
    if (result?.ok) formRef.current?.reset();
    return result;
  }, null);

  return (
    <section className="mt-12 rounded-2xl border border-line bg-card p-5 sm:p-6" aria-labelledby="watch-title">
      <h2 id="watch-title" className="text-xl font-bold">
        Watch alerts
      </h2>
      <p className="mt-1 text-sm text-muted">
        Tell us in your own words what you never want to miss. Each morning we check every new story and company blog
        post against it, and matches appear at the top of your email. Up to {max}.
      </p>

      {watches.length > 0 && (
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {watches.map((w) => (
            <li key={w.id} className="flex items-center justify-between gap-3 py-2.5">
              <span>{w.description}</span>
              <form action={removeWatchAction}>
                <input type="hidden" name="token" value={token} />
                <input type="hidden" name="id" value={w.id} />
                <button type="submit" className="text-sm text-muted hover:text-accent" aria-label={`Stop watching ${w.description}`}>
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {watches.length < max && (
        <form ref={formRef} action={addAction} className="mt-4">
          <input type="hidden" name="token" value={token} />
          <label htmlFor="watch" className="sr-only">
            What should we watch for you?
          </label>
          <div className="flex gap-2">
            <input
              id="watch"
              name="description"
              required
              minLength={3}
              maxLength={160}
              placeholder={`e.g. ${EXAMPLES[watches.length % EXAMPLES.length]}`}
              className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-3 py-2 outline-none focus:border-ink"
            />
            <button type="submit" disabled={pending} className="rounded-lg bg-ink px-4 py-2 font-semibold text-paper hover:opacity-90 disabled:opacity-60">
              {pending ? "Adding…" : "Watch"}
            </button>
          </div>
        </form>
      )}
      {state && (
        <p role="status" className={`mt-2 text-sm ${state.ok ? "text-label" : "text-accent"}`}>
          {state.message}
        </p>
      )}
    </section>
  );
}
