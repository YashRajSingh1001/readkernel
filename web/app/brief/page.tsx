import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/Container";
import { formatDate, listEditions } from "@/lib/brief";

export const metadata: Metadata = {
  title: "Archive",
  description: "Every past ReadKernel brief, day by day.",
};

export default async function Archive() {
  const editions = await listEditions(120);

  return (
    <Container>
      <h1 className="text-4xl title-serif">Every brief</h1>
      <p className="mt-2 mb-8 text-muted">
        One edition a day. Looking for something specific?{" "}
        <Link href="/search" className="text-accent hover:underline">
          Search the archive
        </Link>
        .
      </p>
      {editions.length === 0 ? (
        <p className="text-muted">No editions yet.</p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {editions.map((e, i) => (
            <li key={e.date}>
              <Link href={`/brief/${e.date}`} className="group block py-4">
                <span className="flex items-baseline justify-between gap-4">
                  <span className="font-bold group-hover:text-accent">
                    {formatDate(e.date)}
                    {i === 0 && <span className="ml-2 text-sm font-normal text-label">latest</span>}
                  </span>
                  <span className="shrink-0 text-xs text-muted">{e.story_count} stories</span>
                </span>
                {e.lead && <span className="mt-1 block font-serif text-lg leading-snug text-muted">{e.lead}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
