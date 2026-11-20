import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/Container";
import { formatDate } from "@/lib/brief";
import { listExplainers } from "@/lib/explained";

export const metadata: Metadata = {
  title: "Explained",
  description:
    "One new piece of tech each week: what it is, how it works and how to try it. Drafted by AI from the original source, checked by a person.",
};

export default async function ExplainedIndex() {
  const explainers = await listExplainers();

  return (
    <Container>
      <p className="text-sm font-semibold text-label">Explained</p>
      <h1 className="mt-1 text-4xl font-extrabold tracking-tight">One new thing, explained</h1>
      <p className="mt-2 mb-8 text-muted">
        Each week we pick one new piece of tech from the news and explain what it is, how it works and how to try
        it. AI drafts each one from the original source, and a person checks it before it goes up.
      </p>
      {explainers.length === 0 ? (
        <p className="text-muted">No explainers yet. The first one arrives soon.</p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {explainers.map((e) => (
            <li key={e.slug}>
              <Link href={`/explained/${e.slug}`} className="group block py-4">
                <span className="flex items-baseline justify-between gap-4">
                  <span className="font-bold group-hover:text-accent">{e.title}</span>
                  <span className="shrink-0 text-xs text-muted">Week of {formatDate(e.week_of, "short")}</span>
                </span>
                <span className="mt-1 block leading-snug text-muted">{e.body.what_it_is}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
