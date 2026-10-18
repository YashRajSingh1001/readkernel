"use client";

import Link from "next/link";
import { useState } from "react";

import { AUTH_ENABLED, supabaseBrowser } from "@/lib/supabase/browser";

export function SignInButtons() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!AUTH_ENABLED) {
    return (
      <p className="rounded-xl border border-dashed border-line p-6 text-center text-muted">
        Sign-in is coming soon. You can already{" "}
        <Link href="/#subscribe" className="text-accent underline">
          subscribe by email
        </Link>{" "}
        and save stories on this device.
      </p>
    );
  }

  async function google() {
    const supabase = supabaseBrowser();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/account` },
    });
    if (error) {
      setError("Couldn't start Google sign-in. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={google}
        disabled={busy}
        className="flex w-full items-center justify-center gap-3 rounded-xl border border-line bg-card px-4 py-3 font-semibold hover:border-ink disabled:opacity-60"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
          <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z" />
          <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z" />
          <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8z" />
          <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.8 3.6-4.9 6.7-4.9z" />
        </svg>
        {busy ? "Opening Google…" : "Continue with Google"}
      </button>
      {error && (
        <p role="alert" className="mt-3 text-sm text-accent">
          {error}
        </p>
      )}
    </div>
  );
}
