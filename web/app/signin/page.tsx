import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/Container";
import { SignInButtons } from "@/components/SignInButtons";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default function SignInPage() {
  return (
    <Container className="max-w-md py-8">
      <h1 className="text-3xl title-sans">Sign in to ReadKernel</h1>
      <p className="mt-2 text-muted">
        Optional. Signing in keeps your saved stories on every device and lets you set up your brief without
        confirmation emails.
      </p>
      <div className="mt-8">
        <SignInButtons />
      </div>
      <p className="mt-6 text-xs text-muted">
        We only use your email address to sign you in and send the brief you ask for. See our{" "}
        <Link href="/privacy" className="underline">
          privacy page
        </Link>
        .
      </p>
    </Container>
  );
}
