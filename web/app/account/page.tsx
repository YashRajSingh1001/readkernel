import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { saveAccountPreferencesAction } from "@/app/actions";
import { Container } from "@/components/Container";
import { PreferencesForm } from "@/components/PreferencesForm";
import { SignOutButton } from "@/components/SignOutButton";
import { DEFAULT_PREFS } from "@/lib/personal";
import { adminConfigured } from "@/lib/server/admin-db";
import { getAccountSubscription } from "@/lib/server/subscribers";
import { authEnabled, serverUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Your account", robots: { index: false } };

export default function AccountPage() {
  return (
    <Container>
      <p className="font-mono text-xs tracking-wide text-label uppercase">Account</p>
      <Suspense fallback={<p className="mt-6 text-muted">Loading…</p>}>
        <Account />
      </Suspense>
    </Container>
  );
}

async function Account() {
  if (!authEnabled()) redirect("/signin");
  const user = await serverUser();
  if (!user?.email) redirect("/signin");
  const sub = adminConfigured() ? await getAccountSubscription(user.email.toLowerCase()) : null;
  const subscribed = sub?.status === "active";

  return (
    <>
      <h1 className="mt-1 text-4xl font-extrabold tracking-tight">Hi, {user.user_metadata?.name ?? user.email}</h1>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
        <span>Signed in as {user.email}</span>
        <SignOutButton />
      </div>

      <section className="mt-10">
        <h2 className="text-2xl font-bold">Your brief</h2>
        <p className="mt-1 mb-6 text-muted">
          {subscribed
            ? "You're subscribed. Change anything below and save."
            : "Pick your settings and save to start getting the brief. No confirmation email needed."}
        </p>
        <PreferencesForm initial={sub?.prefs ?? DEFAULT_PREFS} action={saveAccountPreferencesAction} />
        {subscribed && sub?.token && (
          <p className="mt-6 text-sm text-muted">
            <Link href={`/unsubscribe?token=${encodeURIComponent(sub.token)}`} className="underline">
              Stop the emails
            </Link>
          </p>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-bold">Saved stories</h2>
        <p className="mt-1 text-muted">
          Synced with your account on every device.{" "}
          <Link href="/saved" className="text-accent hover:underline">
            Open your saved stories →
          </Link>
        </p>
      </section>
    </>
  );
}
