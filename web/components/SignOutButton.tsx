"use client";

import { useRouter } from "next/navigation";

import { supabaseBrowser } from "@/lib/supabase/browser";

export function SignOutButton() {
  const router = useRouter();
  async function signOut() {
    await supabaseBrowser()?.auth.signOut();
    router.push("/");
    router.refresh();
  }
  return (
    <button type="button" onClick={signOut} className="rounded-md border border-line px-2.5 py-1 hover:border-ink hover:text-ink">
      Sign out
    </button>
  );
}
