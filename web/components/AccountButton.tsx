"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { syncSavedWithAccount } from "@/lib/saved";
import { AUTH_ENABLED, supabaseBrowser } from "@/lib/supabase/browser";

/** "Sign in" or the reader's initial. Hidden entirely while sign-in is turned off. */
export function AccountButton() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = supabaseBrowser();
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user.email ?? null);
      if (data.session) void syncSavedWithAccount();
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setEmail(session?.user.email ?? null);
      if (event === "SIGNED_IN") void syncSavedWithAccount();
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (!AUTH_ENABLED) return null;

  return email ? (
    <Link
      href="/account"
      title={`Signed in as ${email}`}
      aria-label="Your account"
      className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-full bg-label-soft text-sm font-bold text-label uppercase"
    >
      {email[0]}
    </Link>
  ) : (
    <Link href="/signin" className="ml-1 rounded-full px-3 py-1.5 text-sm text-muted hover:bg-sunk hover:text-ink">
      Sign in
    </Link>
  );
}
