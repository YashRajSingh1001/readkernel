import Link from "next/link";

import { TOPICS, TOPIC_BLURBS, formatDate, type Edition } from "@/lib/format";
import { StoryCard } from "./StoryCard";
import { StoryList } from "./StoryList";

type Props = { edition: Edition; topic?: string; olderDate: string | null };

export function FeedView({ edition, topic, olderDate }: Props) {
  const now = Date.parse(edition.generated_at);
  const stories = topic ? edition.feed.filter((s) => s.topic === topic) : edition.feed;
  const releases = stories.filter((s) => s.kind === "model_release");
  const showReleases = releases.length > 0 && (!topic || topic === "ai");
  const sourceCount = new Set(stories.flatMap((s) => s.sources.map((x) => x.name))).size;

  return (
    <>
      <header className="mb-6">
        <h1 className="text-4xl title-serif">
          {topic ? TOPICS[topic] : "Everything worth knowing"}{" "}
          <span className="font-sans text-lg font-normal text-muted tabular-nums">{stories.length}</span>
        </h1>
        <p className="mt-2 text-muted">
          <span className="font-semibold text-ink">{formatDate(edition.date)}.</span>{" "}
          {topic ? TOPIC_BLURBS[topic] : `The day's ${stories.length} best stories from ${sourceCount} sources.`}{" "}
          {!topic && (
            <>
              The top 10 make{" "}
              <Link href="/today" className="text-ink underline decoration-line underline-offset-2 hover:decoration-ink">
                today&apos;s brief
              </Link>
              .
            </>
          )}
        </p>
      </header>

      {showReleases && (
        <section aria-labelledby="model-releases" className="mb-10">
          <h2 id="model-releases" className="section-rule">
            Model releases
          </h2>
          <div className="mt-1">
            {releases.slice(0, 4).map((s) => (
              <StoryCard key={s.story_key ?? s.headline} story={s} now={now} variant="compact" />
            ))}
          </div>
        </section>
      )}

      {stories.length === 0 ? (
        <p className="rounded-md border border-dashed border-line p-8 text-center text-muted">
          No {topic ? TOPICS[topic] : ""} stories today. Check another topic or come back tomorrow.
        </p>
      ) : (
        <StoryList stories={stories} now={now} />
      )}

      {olderDate && (
        <div className="mt-8 border-t border-line pt-6 text-center">
          <Link href={`/brief/${olderDate}`} className="font-medium text-accent hover:underline">
            See older stories: {formatDate(olderDate)}
          </Link>
        </div>
      )}
    </>
  );
}
