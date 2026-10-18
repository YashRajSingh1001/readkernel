"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

export const AUTH_ENABLED =
  process.env.NEXT_PUBLIC_AUTH_ENABLED === "1" &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

let client: SupabaseClient | null = null;

/** One shared client in the browser; null when sign-in is turned off. */
export function supabaseBrowser(): SupabaseClient | null {
  if (!AUTH_ENABLED) return null;
  client ??= createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
  return client;
}
