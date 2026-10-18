import Link from "next/link";

import { TOPICS, domainOf, timeAgo, type Story } from "@/lib/format";
import { SaveButton } from "./SaveButton";

export function StoryCard({ story, rank, now }: { story: Story; rank: number; now: number }) {
  const sourceNames = [...new Set(story.sources.map((s) => s.name))];
  const lead = story.sources[0];
  const href = story.story_key ? `/story/${story.story_key}` : lead?.url;
  const internal = Boolean(story.story_key);

  return (
    <article className="group grid grid-cols-[2rem_1fr] gap-x-3 border-b border-line py-6 last:border-b-0 sm:grid-cols-[2.5rem_1fr]">
      <div className="pt-1 font-serif text-2xl leading-none text-muted tabular-nums">{rank}</div>
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          <span className="rounded-full bg-accent-soft px-2 py-0.5 font-medium text-accent">
            {TOPICS[story.topic] ?? story.topic}
          </span>
          <span>{timeAgo(story.published, now)}</span>
          <span aria-hidden>·</span>
          <span>{sourceNames.length > 1 ? `${sourceNames.length} sources` : sourceNames[0]}</span>
        </div>

        <h2 className="font-serif text-xl leading-snug font-semibold text-balance sm:text-2xl">
          {href && internal ? (
            <Link href={href} className="hover:text-accent">{story.headline}</Link>
          ) : href ? (
            <a href={href} target="_blank" rel="noopener noreferrer" className="hover:text-accent">
              {story.headline}
            </a>
          ) : (
            story.headline
          )}
        </h2>

        {story.summary && <p className="mt-2 leading-relaxed text-pretty">{story.summary}</p>}

        {story.why_it_matters && (
          <p className="mt-3 border-l-2 border-accent pl-3 text-sm leading-relaxed text-muted">
            <span className="font-medium text-ink">Why it matters: </span>
            {story.why_it_matters}
          </p>
        )}

        <ul className="mt-3 flex flex-wrap items-center gap-2">
          {story.sources.map((s) => (
            <li key={s.url}>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                title={s.title}
                className="inline-flex items-center gap-1 rounded-md border border-line bg-card px-2 py-1 text-xs text-muted hover:border-accent hover:text-ink"
              >
                {s.name}
                <span className="hidden opacity-60 sm:inline">{domainOf(s.url)}</span>
              </a>
            </li>
          ))}
          {story.story_key && lead && (
            <li className="ml-auto">
              <SaveButton
                story={{ key: story.story_key, headline: story.headline, topic: story.topic, url: lead.url, source: lead.name }}
              />
            </li>
          )}
        </ul>
      </div>
    </article>
  );
}
