"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { FormState } from "@/app/actions";

type Props = {
  token: string;
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  title: string;
  description: string;
  button: string;
};

export function TokenAction({ token, action, title, description, button }: Props) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, null);

  return (
    <div className="mx-auto max-w-md px-4 py-12 text-center">
      <h1 className="text-3xl font-extrabold">{title}</h1>
      {state ? (
        <>
          <p role="status" className={`mt-4 ${state.ok ? "text-ink" : "text-accent"}`}>{state.message}</p>
          <Link href="/" className="mt-6 inline-block text-accent hover:underline">Read today&apos;s brief</Link>
        </>
      ) : !token ? (
        <p className="mt-4 text-muted">This link is missing its code. Please use the link from your email.</p>
      ) : (
        <form action={formAction} className="mt-4">
          <p className="text-muted">{description}</p>
          <input type="hidden" name="token" value={token} />
          <button
            type="submit"
            disabled={pending}
            className="mt-6 rounded-lg bg-ink px-5 py-2.5 font-medium text-paper hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "One moment…" : button}
          </button>
        </form>
      )}
    </div>
  );
}
