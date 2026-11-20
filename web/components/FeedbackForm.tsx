"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";

import { MAX_MESSAGE, RATINGS, type Rating } from "@/lib/feedback";
import { formatDate } from "@/lib/format";

type Sent = { ok: true; id: string | null } | { ok: false; message: string };
type Saving = { state: "saving" } | { state: "saved"; id: string | null } | { state: "failed"; message: string };

async function send(body: Record<string, unknown>): Promise<Sent> {
  try {
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { id?: string | null; error?: string };
    return res.ok ? { ok: true, id: data.id ?? null } : { ok: false, message: data.error ?? "Something went wrong." };
  } catch {
    return { ok: false, message: "We couldn't reach ReadKernel. Please try again in a minute." };
  }
}

export function FeedbackShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-md px-4 py-12 text-center">
      <h1 className="text-3xl font-extrabold">{title}</h1>
      {children}
      <Link href="/" className="mt-6 inline-block text-accent hover:underline">Read today&apos;s brief</Link>
    </div>
  );
}

function MessageForm({ label, button, done, submit }: {
  label: string;
  button: string;
  done: string;
  submit: (message: string, company: string) => Promise<Sent>;
}) {
  const [state, action, pending] = useActionState<Sent | null, FormData>(
    (_prev, form) => submit(String(form.get("message") ?? ""), String(form.get("company") ?? "")),
    null,
  );
  if (state?.ok) return <p role="status" className="mt-6 text-ink">{done}</p>;
  return (
    <form action={action} className="mt-6 text-left">
      <label htmlFor="feedback-message" className="block text-sm font-medium">{label}</label>
      <textarea
        id="feedback-message"
        name="message"
        required
        rows={4}
        maxLength={MAX_MESSAGE}
        className="mt-2 w-full rounded-lg border border-line bg-card px-3 py-2 text-base outline-none focus:border-ink"
      />
      <input type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      <button
        type="submit"
        disabled={pending}
        className="mt-3 rounded-lg bg-ink px-5 py-2.5 font-medium text-paper hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Sending…" : button}
      </button>
      {state && !state.ok && <p role="alert" className="mt-2 text-sm text-accent">{state.message}</p>}
    </form>
  );
}

export function RatingFeedback({ date, rating, token }: { date: string; rating: Rating; token: string | null }) {
  const [saving, setSaving] = useState<Saving>({ state: "saving" });
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    send({ kind: "brief_rating", date, rating, token }).then((r) =>
      setSaving(r.ok ? { state: "saved", id: r.id } : { state: "failed", message: r.message }),
    );
  }, [date, rating, token]);

  return (
    <FeedbackShell title={saving.state === "saved" ? "Thanks" : "How was the brief?"}>
      <p className="mt-4 text-muted">
        {formatDate(date)}: <span className="font-medium text-ink">{RATINGS[rating]}</span>
      </p>
      {saving.state === "saving" && <p role="status" className="mt-4 text-muted">Saving your rating…</p>}
      {saving.state === "failed" && <p role="alert" className="mt-4 text-accent">{saving.message}</p>}
      {saving.state === "saved" && (
        <>
          <p role="status" className="mt-4">Got it. Pick another link in the email to change your rating.</p>
          {saving.id && (
            <MessageForm
              label="Anything to add?"
              button="Send"
              done="Thanks, we'll read it."
              submit={(message, company) => send({ kind: "note", id: saving.id, message, company })}
            />
          )}
        </>
      )}
    </FeedbackShell>
  );
}

export function StoryReport({ storyKey, date, headline }: { storyKey: string; date: string; headline: string }) {
  return (
    <FeedbackShell title="Report a mistake">
      <p className="mt-4 text-muted">
        In <Link href={`/story/${storyKey}`} className="font-medium text-ink hover:text-accent">{headline}</Link>
      </p>
      <MessageForm
        label="What's wrong?"
        button="Send report"
        done="Thanks. We'll check it and fix the story if it's wrong."
        submit={(message, company) => send({ kind: "story_report", story: storyKey, date, message, company })}
      />
    </FeedbackShell>
  );
}
