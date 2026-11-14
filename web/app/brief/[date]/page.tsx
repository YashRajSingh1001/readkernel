import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Container } from "@/components/Container";
import { EditionView } from "@/components/EditionView";
import { formatDate, getEdition, isValidDate, listEditions } from "@/lib/brief";

export async function generateStaticParams() {
  const editions = await listEditions(30);
  return editions.length ? editions.map((e) => ({ date: e.date })) : [{ date: "2026-01-01" }];
}

export async function generateMetadata({ params }: PageProps<"/brief/[date]">): Promise<Metadata> {
  const { date } = await params;
  if (!isValidDate(date)) return {};
  const edition = await getEdition(date);
  return {
    title: `10 stories that mattered · ${formatDate(date)}`,
    description: edition?.stories
      .slice(0, 3)
      .map((s) => s.headline)
      .join(" · "),
  };
}

export default function BriefForDay({ params }: PageProps<"/brief/[date]">) {
  return (
    <Suspense fallback={<Container><p className="text-muted">Loading…</p></Container>}>
      <Day params={params} />
    </Suspense>
  );
}

async function Day({ params }: { params: PageProps<"/brief/[date]">["params"] }) {
  const { date } = await params;
  const edition = await getEdition(date);
  if (!edition) notFound();
  return <EditionView edition={edition} />;
}
