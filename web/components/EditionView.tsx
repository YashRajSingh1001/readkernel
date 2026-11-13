import Link from "next/link";
import { Fragment } from "react";

import { formatDate, formatTimeIST, readingMinutes, type Edition } from "@/lib/format";
import { siteUrl } from "@/lib/site";
import { Container } from "./Container";
import { ShareButtons } from "./ShareButtons";
import { SignupForm } from "./SignupForm";
import { StoryCard } from "./StoryCard";

export function EditionView({ edition, isLatest = false }: { edition: Edition; isLatest?: boolean }) {
  const now = Date.parse(edition.generated_at);
  const [first, ...others] = edition.stories;
  const sourceCount = new Set(edition.stories.flatMap((s) => s.sources.map((x) => x.name))).size;
  const minutes = readingMinutes(edition.stories);
  const more = edition.feed.length - edition.stories.length;
  const url = `${siteUrl()}/brief/${edition.date}`;

  return (
    <Container>
      <header className="mb-8">
        <h1 className="text-4xl title-serif sm:text-5xl">{formatDate(edition.date, "full")}</h1>
        <p className="mt-2 text-[0.9375rem] text-muted tabular-nums">
          <span className="font-semibold text-ink">{isLatest ? "Today's brief" : "Daily brief"}</span> · published{" "}
          {formatTimeIST(edition.generated_at)} · {edition.stories.length} stories from {sourceCount} sources · about {minutes} min read
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <ShareButtons url={url} title={`ReadKernel · ${formatDate(edition.date)}`} />
        </div>
      </header>

      {first && (
        <section aria-labelledby="story-of-the-day">
          <h2 id="story-of-the-day" className="mb-3 section-rule">
            Story of the day
          </h2>
          <StoryCard story={first} now={now} variant="lead" />
        </section>
      )}

      {/* The rest in importance order, 2 to 10. Each card shows its own topic. */}
      {others.length > 0 && (
        <section className="mt-8" aria-labelledby="rest-of-brief">
          <h2 id="rest-of-brief" className="mb-3 section-rule">
            The rest of the brief
          </h2>
          {others.map((story, i) => (
            <Fragment key={story.story_key ?? story.headline}>
              <StoryCard story={story} now={now} rank={i + 2} />
              {i === 2 && others.length > 4 && (
                <div className="my-6" id="subscribe">
                  <SignupForm compact />
                </div>
              )}
            </Fragment>
          ))}
        </section>
      )}

      <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6 text-sm">
        <Link href="/brief" className="text-muted hover:text-ink">
          ← All briefs
        </Link>
        {more > 0 && (
          <Link href="/feed" className="font-medium text-accent hover:underline">
            {more} more stories in the feed
          </Link>
        )}
      </div>
    </Container>
  );
}
