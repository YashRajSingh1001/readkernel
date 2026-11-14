import Link from "next/link";

import { TOPICS, timeAgo, type Story } from "@/lib/format";
import { SaveButton } from "./SaveButton";
import { SourceIcons } from "./SourceIcons";
import { StoryImage } from "./StoryImage";

type Props = {
  story: Story;
  now: number;
  rank?: number;
  variant?: "lead" | "standard" | "compact";
  showImage?: boolean;
};

export function StoryCard({ story, now, rank, variant = "standard", showImage = true }: Props) {
  const lead = story.sources[0];
  const href = story.story_key ? `/story/${story.story_key}` : lead?.url;
  const internal = Boolean(story.story_key);
  const sourceCount = new Set(story.sources.map((s) => s.name)).size;

  const title = (
    <h3
      className={`font-serif leading-snug font-semibold text-balance ${
        variant === "lead" ? "text-2xl sm:text-3xl" : variant === "compact" ? "text-base" : "text-xl"
      }`}
    >
      {href && internal ? (
        <Link href={href} className="hover:text-accent">
          {story.headline}
        </Link>
      ) : href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="hover:text-accent">
          {story.headline}
        </a>
      ) : (
        story.headline
      )}
    </h3>
  );

  const meta = (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
      {rank != null && <span className="text-ink tabular-nums">#{rank}</span>}
      <span className="rounded-full bg-accent-soft px-2 py-0.5 font-medium text-accent">
        {TOPICS[story.topic] ?? story.topic}
      </span>
      {story.kind === "model_release" && (
        <span className="rounded-full bg-label-soft px-2 py-0.5 font-medium text-label">Model release</span>
      )}
      <span>{timeAgo(story.published, now)}</span>
      {sourceCount > 1 && <span className="font-medium text-ink">{sourceCount} sources</span>}
    </div>
  );

  const footer = (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
      <SourceIcons sources={story.sources} />
      {story.story_key && lead && (
        <SaveButton
          story={{ key: story.story_key, headline: story.headline, topic: story.topic, url: lead.url, source: lead.name }}
        />
      )}
    </div>
  );

  if (variant === "compact") {
    return (
      <article className="flex gap-3 border-b border-line py-4 last:border-b-0">
        {showImage && (
          <div className="w-20 shrink-0 sm:w-24">
            <StoryImage src={story.image_url} topic={story.topic} headline={story.headline} size="thumb" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          {meta}
          <div className="mt-1">{title}</div>
          <div className="mt-1.5 text-xs text-muted">
            <SourceIcons sources={story.sources} max={3} />
          </div>
        </div>
      </article>
    );
  }

  if (variant === "lead") {
    return (
      <article className="border-b border-line pb-8">
        {showImage && (
          <StoryImage
            src={story.image_url}
            credit={story.image_credit}
            topic={story.topic}
            headline={story.headline}
            size="lead"
            sourceName={lead?.name}
            sourceUrl={lead?.url}
          />
        )}
        <div className="mt-4">{meta}</div>
        <div className="mt-2">{title}</div>
        {story.summary && <p className="mt-3 text-lg leading-relaxed text-pretty">{story.summary}</p>}
        {story.why_it_matters && (
          <p className="mt-3 border-l-2 border-accent pl-3 leading-relaxed text-muted">
            <span className="font-medium text-ink">Why it matters: </span>
            {story.why_it_matters}
          </p>
        )}
        {footer}
      </article>
    );
  }

  return (
    <article className="grid gap-4 border-b border-line py-6 last:border-b-0 sm:grid-cols-[1fr_200px]">
      <div className="min-w-0 sm:order-1">
        {meta}
        <div className="mt-2">{title}</div>
        {story.summary && <p className="mt-2 leading-relaxed text-pretty">{story.summary}</p>}
        {story.why_it_matters && (
          <p className="mt-3 border-l-2 border-accent pl-3 text-sm leading-relaxed text-muted">
            <span className="font-medium text-ink">Why it matters: </span>
            {story.why_it_matters}
          </p>
        )}
        {footer}
      </div>
      {showImage && (
        <div className="sm:order-2">
          <StoryImage
            src={story.image_url}
            credit={story.image_credit}
            topic={story.topic}
            headline={story.headline}
            sourceName={lead?.name}
            sourceUrl={lead?.url}
          />
        </div>
      )}
    </article>
  );
}
