import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Container } from "@/components/Container";
import { TOPICS, formatDate, searchStories } from "@/lib/brief";

export const metadata: Metadata = {
  title: "Search",
  description: "Search every story ReadKernel has covered.",
  robots: { index: false },
};

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <Container>
      <p className="font-mono text-xs tracking-wide text-label uppercase">Search</p>
      <h1 className="mt-1 text-4xl font-extrabold tracking-tight">Search the archive</h1>
      <Suspense fallback={<SearchBox q="" />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}

function SearchBox({ q }: { q: string }) {
  return (
    <form action="/search" role="search" className="mt-6 flex gap-2">
      <label htmlFor="q" className="sr-only">
        Search stories
      </label>
      <input
        id="q"
        name="q"
        type="search"
        defaultValue={q}
        placeholder="e.g. Nvidia, funding, data breach"
        className="min-w-0 flex-1 rounded-lg border border-line bg-card px-4 py-2.5 text-base outline-none focus:border-ink"
        autoFocus
      />
      <button type="submit" className="rounded-lg bg-ink px-5 py-2.5 font-semibold text-paper hover:opacity-90">
        Search
      </button>
    </form>
  );
}

async function Results({ searchParams }: { searchParams: PageProps<"/search">["searchParams"] }) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  const results = query.length >= 2 ? await searchStories(query) : [];

  return (
    <>
      <SearchBox q={query} />
      {query.length >= 2 && (
        <p className="mt-6 text-sm text-muted">
          {results.length === 0
            ? `No stories match "${query}". Try fewer or different words.`
            : `${results.length} ${results.length === 1 ? "story" : "stories"} match "${query}", newest first.`}
        </p>
      )}
      <ul className="mt-4 divide-y divide-line">
        {results.map((s) => (
          <li key={`${s.edition_date}-${s.story_key}`} className="py-4">
            <p className="font-mono text-xs text-muted">
              {formatDate(s.edition_date)} · {TOPICS[s.topic] ?? s.topic}
            </p>
            <Link href={`/story/${s.story_key}`} className="mt-1 block font-serif text-lg leading-snug font-semibold hover:text-accent">
              {s.headline}
            </Link>
            {s.summary && <p className="mt-1 line-clamp-2 text-sm text-muted">{s.summary}</p>}
          </li>
        ))}
      </ul>
      {query.length < 2 && (
        <p className="mt-6 text-sm text-muted">
          Tip: use quotes for exact phrases, like &quot;open weights&quot;, and a minus to exclude a word.
        </p>
      )}
    </>
  );
}
