import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Container } from "@/components/Container";
import { ListenButton } from "@/components/ListenButton";
import { SaveButton } from "@/components/SaveButton";
import { ShareButtons } from "@/components/ShareButtons";
import { SourceIcons } from "@/components/SourceIcons";
import { StoryCard } from "@/components/StoryCard";
import { StoryImage } from "@/components/StoryImage";
import { TOPICS, domainOf, formatDate, getEdition, getLatestEdition, getStory, getThread, timeAgo } from "@/lib/brief";
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
    <Suspense fallback={<Container><p className="text-muted">Loading…</p></Container>}>
      <StoryView params={params} />
    </Suspense>
  );
}

async function StoryView({ params }: { params: PageProps<"/story/[key]">["params"] }) {
  const { key } = await params;
  const story = await getStory(key);
  if (!story) notFound();

  const [edition, thread] = await Promise.all([
    getEdition(story.edition_date),
    story.thread_id ? getThread(story.thread_id) : Promise.resolve([]),
  ]);
  const related = (edition?.feed ?? [])
    .filter((s) => s.topic === story.topic && s.story_key !== key)
    .slice(0, 4);
  const earlier = thread.filter((t) => t.edition_date !== story.edition_date || t.story_key === key);
  const lead = story.sources[0];
  const now = edition ? Date.parse(edition.generated_at) : Date.parse(story.published);
  const url = `${siteUrl()}/story/${key}`;
  const sourceCount = new Set(story.sources.map((s) => s.name)).size;

  return (
    <Container>
      <article>
        <Link href={`/brief/${story.edition_date}`} className="mb-6 inline-block text-sm text-muted hover:text-ink">
          ← {formatDate(story.edition_date)}
        </Link>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          <Link href={`/feed/${story.topic}`} className="rounded-full bg-accent-soft px-2 py-0.5 font-medium text-accent">
            {TOPICS[story.topic] ?? story.topic}
          </Link>
          {story.kind === "model_release" && (
            <span className="rounded-full bg-label-soft px-2 py-0.5 font-medium text-label">Model release</span>
          )}
          {story.brief_position != null && (
            <span className="font-medium text-ink">#{story.brief_position} in the daily brief</span>
          )}
          <span>{sourceCount > 1 ? `${sourceCount} sources` : lead?.name}</span>
        </div>

        <h1 className="mt-3 text-3xl leading-tight font-extrabold tracking-tight text-balance sm:text-4xl">
          {story.headline}
        </h1>

        <div className="mt-6">
          <StoryImage
            src={story.image_url}
            credit={story.image_credit}
            topic={story.topic}
            headline={story.headline}
            size="lead"
            sourceName={lead?.name}
            sourceUrl={lead?.url}
          />
        </div>

        {story.summary && <p className="mt-6 text-lg leading-relaxed text-pretty">{story.summary}</p>}

        {story.why_it_matters && (
          <p className="mt-5 border-l-2 border-accent pl-4 leading-relaxed text-muted">
            <span className="font-medium text-ink">Why it matters: </span>
            {story.why_it_matters}
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-y border-line py-3">
          <div className="flex flex-wrap items-center gap-2">
            <ListenButton parts={[story.headline, story.summary, story.why_it_matters].filter(Boolean)} />
            <ShareButtons url={url} title={story.headline} />
          </div>
          {lead && (
            <SaveButton story={{ key, headline: story.headline, topic: story.topic, url: lead.url, source: lead.name }} />
          )}
        </div>

        <section className="mt-8">
          <h2 className="text-xl font-bold">Read the coverage</h2>
          <ul className="mt-3 divide-y divide-line">
            {story.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="group flex gap-3 py-3">
                  <SourceIcons sources={[s]} max={1} />
                  <span className="min-w-0 flex-1">
                    <span className="block leading-snug group-hover:text-accent">{s.title} ↗</span>
                    <span className="text-xs text-muted">
                      {domainOf(s.url)} · {timeAgo(s.published, now)}
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>

        {earlier.length > 1 && (
          <section className="mt-10" aria-labelledby="so-far">
            <h2 id="so-far" className="text-xl font-bold">
              This story so far
            </h2>
            <p className="text-sm text-muted">How it developed, day by day.</p>
            <ol className="mt-4 border-l-2 border-line pl-5">
              {earlier.map((t) => (
                <li key={t.edition_date} className="relative pb-5 last:pb-0">
                  <span
                    className={`absolute top-1.5 -left-[27px] h-3 w-3 rounded-full border-2 border-paper ${t.story_key === key ? "bg-accent" : "bg-muted"}`}
                    aria-hidden
                  />
                  <p className="font-mono text-xs text-muted">{formatDate(t.edition_date)}</p>
                  {t.story_key === key ? (
                    <p className="font-semibold">{t.headline} (this page)</p>
                  ) : (
                    <Link href={`/story/${t.story_key}`} className="font-semibold hover:text-accent">
                      {t.headline}
                    </Link>
                  )}
                </li>
              ))}
            </ol>
          </section>
        )}

        {related.length > 0 && (
          <section className="mt-10">
            <h2 className="text-xl font-bold">More in {TOPICS[story.topic] ?? story.topic}</h2>
            <div className="mt-1">
              {related.map((s) => (
                <StoryCard key={s.story_key} story={s} now={now} variant="compact" />
              ))}
            </div>
          </section>
        )}
      </article>
    </Container>
  );
}
