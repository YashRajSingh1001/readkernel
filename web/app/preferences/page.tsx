import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { savePreferencesAction } from "@/app/actions";
import { Container } from "@/components/Container";
import { PreferencesForm } from "@/components/PreferencesForm";
import { WatchList } from "@/components/WatchList";
import { adminConfigured } from "@/lib/server/admin-db";
import { MAX_WATCHES, getByToken, listWatches } from "@/lib/server/subscribers";

export const metadata: Metadata = { title: "Your brief settings", robots: { index: false } };

export default function PreferencesPage({ searchParams }: PageProps<"/preferences">) {
  return (
    <Container>
      <h1 className="text-4xl title-sans">Change your settings</h1>
      <Suspense fallback={<p className="mt-6 text-muted">Loading…</p>}>
        <Settings searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}

async function Settings({ searchParams }: { searchParams: PageProps<"/preferences">["searchParams"] }) {
  const { token } = await searchParams;
  const subscriber = typeof token === "string" && adminConfigured() ? await getByToken(token) : null;

  if (!subscriber || typeof token !== "string") {
    return (
      <p className="mt-6 text-muted">
        This link isn&apos;t valid. Use the &ldquo;Change topics or format&rdquo; link in your latest email, or{" "}
        <Link href="/brief/customize" className="text-accent hover:underline">
          build a new brief
        </Link>
        .
      </p>
    );
  }

  return (
    <>
      <p className="mt-2 mb-8 text-muted">
        For <span className="font-medium text-ink">{subscriber.email}</span>.
        {subscriber.status === "unsubscribed" && " You're unsubscribed; saving will start your emails again."}
      </p>
      <PreferencesForm initial={subscriber.prefs} action={savePreferencesAction} token={token} />
      <WatchList token={token} watches={await listWatches(token).catch(() => [])} max={MAX_WATCHES} />
      <p className="mt-10 text-sm text-muted">
        Want to stop the emails?{" "}
        <Link href={`/unsubscribe?token=${encodeURIComponent(token)}`} className="underline">
          Unsubscribe
        </Link>
        .
      </p>
    </>
  );
}
