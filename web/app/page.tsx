import Link from "next/link";

import { EditionView } from "@/components/EditionView";
import { SignupForm } from "@/components/SignupForm";
import { getLatestEdition } from "@/lib/brief";

export default async function Home() {
  const edition = await getLatestEdition();

  if (!edition) {
    return (
      <div className="py-16 text-center">
        <h1 className="font-serif text-3xl font-semibold">No brief yet</h1>
        <p className="mt-3 text-muted">
          The first edition appears after the pipeline runs. Locally: run{" "}
          <code className="rounded bg-card px-1.5 py-0.5 text-sm">python -m kernel.run</code> in{" "}
          <code className="rounded bg-card px-1.5 py-0.5 text-sm">pipeline/</code>.
        </p>
      </div>
    );
  }

  const more = edition.feed.length - edition.stories.length;

  return (
    <>
      <p className="mb-8 max-w-2xl leading-relaxed text-muted">
        Every morning ReadKernel reads dozens of tech and AI news sources, merges duplicate coverage, and picks the
        ten stories that matter, each with a short summary and every source linked.{" "}
        <Link href="/how-it-works" className="text-ink underline decoration-line underline-offset-2 hover:decoration-ink">
          How it works
        </Link>
      </p>
      <EditionView edition={edition}>
        <SignupForm />
      </EditionView>
      {more > 0 && (
        <div className="mt-8 border-t border-line pt-6 text-center">
          <Link href="/feed" className="font-medium text-accent hover:underline">
            {more} more stories in today&apos;s feed →
          </Link>
        </div>
      )}
    </>
  );
}
