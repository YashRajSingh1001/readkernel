import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/Container";
import { SavedList } from "@/components/SavedList";

export const metadata: Metadata = { title: "Saved", robots: { index: false } };

export default function SavedPage() {
  return (
    <Container>
      <p className="text-sm font-semibold text-label">Saved</p>
      <h1 className="mt-1 mb-2 text-4xl font-extrabold tracking-tight">Your reading list</h1>
      <p className="mb-6 text-sm leading-relaxed text-muted">
        Saved in <strong className="font-medium text-ink">this browser</strong> only, with no account needed and
        nothing sent to us. That also means stories saved in one browser (say Firefox) won&apos;t show up in another
        (Safari, or your phone).{" "}
        {process.env.NEXT_PUBLIC_AUTH_ENABLED === "1" ? (
          <>
            <Link href="/signin" className="text-accent hover:underline">
              Sign in
            </Link>{" "}
            to keep them on every device.
          </>
        ) : (
          "Signing in to keep them on every device is coming soon."
        )}
      </p>
      <SavedList />
    </Container>
  );
}
