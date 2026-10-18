import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { EntryArticle } from "@/components/ContentPages";
import { getEntry, listEntries } from "@/lib/content";

export async function generateStaticParams() {
  const entries = await listEntries("blog");
  return entries.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const entry = await getEntry("blog", slug);
  return entry ? { title: entry.title, description: entry.description } : {};
}

export default function Page({ params }: PageProps<"/blog/[slug]">) {
  return (
    <Suspense>
      <Article params={params} />
    </Suspense>
  );
}

async function Article({ params }: { params: PageProps<"/blog/[slug]">["params"] }) {
  const { slug } = await params;
  const entry = await getEntry("blog", slug);
  if (!entry) notFound();
  return <EntryArticle entry={entry} back="/blog" backLabel="All posts" />;
}
