import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { EditionView } from "@/components/EditionView";
import { formatDate, getEdition, isValidDate, listEditions } from "@/lib/brief";

// Pre-build the archive's days; newer days render on first visit.
export async function generateStaticParams() {
  const editions = await listEditions(30);
  return editions.length ? editions.map((e) => ({ date: e.date })) : [{ date: "2026-01-01" }];
}

export async function generateMetadata({ params }: PageProps<"/brief/[date]">): Promise<Metadata> {
  const { date } = await params;
  if (!isValidDate(date)) return {};
  const edition = await getEdition(date);
  return {
    title: `Brief for ${formatDate(date)}`,
    description: edition?.stories
      .slice(0, 3)
      .map((s) => s.headline)
      .join(" · "),
  };
}

export default function BriefForDay({ params }: PageProps<"/brief/[date]">) {
  return (
    <>
      <Link href="/brief" className="mb-6 inline-block text-sm text-muted hover:text-ink">
        ← All briefs
      </Link>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <Day params={params} />
      </Suspense>
    </>
  );
}

async function Day({ params }: { params: PageProps<"/brief/[date]">["params"] }) {
  const { date } = await params;
  const edition = await getEdition(date);
  if (!edition) notFound();
  return <EditionView edition={edition} title="Daily brief" />;
}
