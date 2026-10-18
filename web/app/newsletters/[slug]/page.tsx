import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { EntryArticle } from "@/components/ContentPages";
import { getEntry, listEntries } from "@/lib/content";

export async function generateStaticParams() {
  const entries = await listEntries("newsletters");
  return entries.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: PageProps<"/newsletters/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const entry = await getEntry("newsletters", slug);
  return entry ? { title: entry.title, description: entry.description } : {};
}

export default function Page({ params }: PageProps<"/newsletters/[slug]">) {
  return (
    <Suspense>
      <Article params={params} />
    </Suspense>
  );
}

async function Article({ params }: { params: PageProps<"/newsletters/[slug]">["params"] }) {
  const { slug } = await params;
  const entry = await getEntry("newsletters", slug);
  if (!entry) notFound();
  return <EntryArticle entry={entry} back="/newsletters" backLabel="All reviews" />;
}
