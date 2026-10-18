import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { SaveButton } from "@/components/SaveButton";
import { ShareButtons } from "@/components/ShareButtons";
import { TOPICS, domainOf, formatDate, getEdition, getLatestEdition, getStory, timeAgo } from "@/lib/brief";
import { siteUrl } from "@/lib/site";

// Pre-build today's stories; older ones render on first visit.
export async function generateStaticParams() {
  const edition = await getLatestEdition();
  const keys = edition?.feed.map((s) => s.story_key).filter((k): k is string => Boolean(k)) ?? [];
  return keys.length ? keys.map((key) => ({ key })) : [{ key: "placeholder" }];
}

export async function generateMetadata({ params }: PageProps<"/story/[key]">): Promise<Metadata> {
  const { key } = await params;
  const story = await getStory(key);
  if (!story) return {};
  const description = story.summary || story.sources[0]?.title || "";
  return {
    title: story.headline,
    description,
    openGraph: { title: story.headline, description, type: "article", url: `${siteUrl()}/story/${key}` },
    twitter: { card: "summary_large_image", title: story.headline, description },
  };
}

export default function StoryPage({ params }: PageProps<"/story/[key]">) {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <StoryView params={params} />
    </Suspense>
  );
}

async function StoryView({ params }: { params: PageProps<"/story/[key]">["params"] }) {
  const { key } = await params;
  const story = await getStory(key);
  if (!story) notFound();

  const edition = await getEdition(story.edition_date);
  const related = (edition?.feed ?? [])
    .filter((s) => s.topic === story.topic && s.story_key !== key)
    .slice(0, 4);
  const lead = story.sources[0];
  const now = edition ? Date.parse(edition.generated_at) : Date.parse(story.published);
  const url = `${siteUrl()}/story/${key}`;

  return (
    <article>
      <Link href={`/brief/${story.edition_date}`} className="mb-6 inline-block text-sm text-muted hover:text-ink">
        ← {formatDate(story.edition_date)}
      </Link>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
        <span className="rounded-full bg-accent-soft px-2 py-0.5 font-medium text-accent">
          {TOPICS[story.topic] ?? story.topic}
        </span>
        {story.brief_position != null && <span className="font-medium text-ink">#{story.brief_position} in the daily brief</span>}
        <span>{story.sources.length > 1 ? `${new Set(story.sources.map((s) => s.name)).size} sources` : lead?.name}</span>
      </div>

      <h1 className="mt-3 font-serif text-3xl leading-tight font-semibold text-balance sm:text-4xl">{story.headline}</h1>

      {story.summary && <p className="mt-4 text-lg leading-relaxed text-pretty">{story.summary}</p>}

      {story.why_it_matters && (
        <p className="mt-5 border-l-2 border-accent pl-4 leading-relaxed text-muted">
          <span className="font-medium text-ink">Why it matters: </span>
          {story.why_it_matters}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-y border-line py-3">
        <ShareButtons url={url} title={story.headline} />
        {lead && (
          <SaveButton story={{ key, headline: story.headline, topic: story.topic, url: lead.url, source: lead.name }} />
        )}
      </div>

      <section className="mt-8">
        <h2 className="font-serif text-xl font-semibold">Read the coverage</h2>
        <ul className="mt-3 divide-y divide-line">
          {story.sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="group block py-3">
                <span className="text-xs text-muted">
                  {s.name} · {domainOf(s.url)} · {timeAgo(s.published, now)}
                </span>
                <span className="mt-0.5 block leading-snug group-hover:text-accent">{s.title} ↗</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      {related.length > 0 && (
        <section className="mt-10">
          <h2 className="font-serif text-xl font-semibold">More in {TOPICS[story.topic] ?? story.topic}</h2>
          <ul className="mt-3 divide-y divide-line">
            {related.map((s) => (
              <li key={s.story_key}>
                <Link href={`/story/${s.story_key}`} className="block py-3 leading-snug hover:text-accent">
                  {s.headline}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
