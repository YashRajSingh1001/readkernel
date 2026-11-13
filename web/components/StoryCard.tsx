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

/**
 * One story. "lead" = big photo on top (story of the day), "standard" = photo
 * beside the text, "compact" = small thumbnail, headline and byline only.
 */
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
        <Link href={href} className="rk-headline">
          {story.headline}
        </Link>
      ) : href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="rk-headline">
          {story.headline}
        </a>
      ) : (
        story.headline
      )}
    </h3>
  );

  const meta = (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted">
      <span className="font-semibold text-accent">{TOPICS[story.topic] ?? story.topic}</span>
      {story.kind === "model_release" && <span className="font-semibold text-label">Model release</span>}
      <span aria-hidden>·</span>
      <span>{timeAgo(story.published, now)}</span>
      {sourceCount > 1 && (
        <>
          <span aria-hidden>·</span>
          <span className="text-ink tabular-nums">{sourceCount} sources</span>
        </>
      )}
    </div>
  );

  const footer = (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
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
        {rank != null && (
          <span className="w-6 shrink-0 font-serif text-xl leading-tight font-semibold text-muted tabular-nums" aria-label={`Number ${rank}`}>
            {rank}
          </span>
        )}
        {showImage && (
          <div className="w-20 shrink-0 sm:w-24">
            <StoryImage src={story.image_url} topic={story.topic} headline={story.headline} size="thumb" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          {meta}
          <div className="mt-1">{title}</div>
          <div className="mt-1.5 text-sm text-muted">
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
        {story.summary && <p className="mt-3 font-serif text-lg leading-relaxed text-pretty">{story.summary}</p>}
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

  // Ranked stories (the brief, 2 to 10) get their number in a left gutter, like a printed list.
  const gutter = rank != null;
  return (
    <article
      className={`grid gap-4 border-b border-line py-6 last:border-b-0 ${
        gutter ? "grid-cols-[2rem_1fr] sm:grid-cols-[2.5rem_1fr_200px]" : "sm:grid-cols-[1fr_200px]"
      }`}
    >
      {gutter && (
        <span className="row-span-2 font-serif text-2xl leading-none font-semibold text-muted tabular-nums sm:row-span-1" aria-label={`Number ${rank}`}>
          {rank}
        </span>
      )}
      <div className="min-w-0 sm:order-1">
        {meta}
        <div className="mt-2">{title}</div>
        {story.summary && <p className="mt-2 font-serif leading-relaxed text-pretty">{story.summary}</p>}
        {story.why_it_matters && (
          <p className="mt-3 border-l-2 border-accent pl-3 text-sm leading-relaxed text-muted">
            <span className="font-medium text-ink">Why it matters: </span>
            {story.why_it_matters}
          </p>
        )}
        {footer}
      </div>
      {showImage && (
        <div className={`sm:order-2 ${gutter ? "col-start-2 sm:col-start-auto" : ""}`}>
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
