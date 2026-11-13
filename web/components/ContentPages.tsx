import Link from "next/link";

import { formatDate } from "@/lib/format";
import type { Entry } from "@/lib/content";
import { Container } from "./Container";

/** List page for blog posts, guides or reviews. */
export function EntryList({
  label,
  title,
  intro,
  base,
  entries,
}: {
  label: string;
  title: string;
  intro: string;
  base: string;
  entries: Entry[];
}) {
  return (
    <Container>
      <p className="text-sm font-semibold text-label">{label}</p>
      <h1 className="mt-1 text-4xl font-extrabold tracking-tight">{title}</h1>
      <p className="mt-3 mb-8 leading-relaxed text-muted">{intro}</p>
      <ul className="divide-y divide-line border-y border-line">
        {entries.map((e) => (
          <li key={e.slug}>
            <Link href={`${base}/${e.slug}`} className="group block py-5">
              <span className="flex flex-wrap items-baseline justify-between gap-x-4">
                <span className="font-serif text-xl font-semibold group-hover:text-accent">{e.title}</span>
                {e.meta.rating && (
                  <span className="text-sm text-accent" aria-label={`${e.meta.rating} out of 5`}>
                    {"★".repeat(Number(e.meta.rating))}
                    <span className="text-line">{"★".repeat(5 - Number(e.meta.rating))}</span>
                  </span>
                )}
              </span>
              <span className="mt-1 block text-muted">{e.description}</span>
              {e.meta.frequency && (
                <span className="mt-2 inline-flex gap-2 text-xs text-muted">
                  <span className="rounded-full border border-line px-2 py-0.5">{e.meta.frequency}</span>
                  {e.meta.price && <span className="rounded-full border border-line px-2 py-0.5">{e.meta.price}</span>}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </Container>
  );
}

/** One article. */
export function EntryArticle({ entry, back, backLabel }: { entry: Entry; back: string; backLabel: string }) {
  const { meta } = entry;
  return (
    <Container>
      <Link href={back} className="mb-6 inline-block text-sm text-muted hover:text-ink">
        ← {backLabel}
      </Link>
      <article>
        <h1 className="text-4xl leading-tight font-extrabold tracking-tight text-balance">{entry.title}</h1>
        {entry.description && <p className="mt-3 text-lg text-muted">{entry.description}</p>}
        {entry.date && <p className="mt-3 text-xs text-muted">{formatDate(entry.date, "short")}</p>}
        {meta.rating && (
          <dl className="mt-6 grid gap-3 rounded-xl border border-line bg-card p-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-muted">Our rating</dt>
              <dd className="text-accent">{"★".repeat(Number(meta.rating))}{"☆".repeat(5 - Number(meta.rating))}</dd>
            </div>
            <div>
              <dt className="text-muted">How often</dt>
              <dd className="font-medium">{meta.frequency}</dd>
            </div>
            <div>
              <dt className="text-muted">Price</dt>
              <dd className="font-medium">{meta.price}</dd>
            </div>
            <div>
              <dt className="text-muted">Website</dt>
              <dd>
                <a href={meta.url} target="_blank" rel="noopener noreferrer" className="font-medium text-accent hover:underline">
                  Visit ↗
                </a>
              </dd>
            </div>
            {meta.verdict && (
              <div className="sm:col-span-4">
                <dt className="text-muted">In one line</dt>
                <dd className="font-medium">{meta.verdict}</dd>
              </div>
            )}
          </dl>
        )}
        <div className="prose-rk mt-8" dangerouslySetInnerHTML={{ __html: entry.html }} />
      </article>
      <div className="mt-12 rounded-2xl bg-ink p-6 text-paper sm:p-8">
        <h2 className="text-2xl font-extrabold">Get the day&apos;s tech news in five minutes</h2>
        <p className="mt-1 opacity-80">Ten stories, every source linked. Free, every morning.</p>
        <Link href="/#subscribe" className="mt-4 inline-block rounded-full bg-accent px-5 py-2.5 font-semibold text-white hover:opacity-90">
          Subscribe free
        </Link>
      </div>
    </Container>
  );
}
