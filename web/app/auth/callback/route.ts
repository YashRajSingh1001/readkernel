import { NextResponse } from "next/server";

import { authEnabled, supabaseServer } from "@/lib/supabase/server";

// Google sends the reader back here with a one-time code; swap it for a session cookie.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/account";
  // Only ever redirect within this site.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/account";

  if (authEnabled() && code) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(safeNext, url.origin));
  }
  return NextResponse.redirect(new URL("/signin?error=1", url.origin));
}
