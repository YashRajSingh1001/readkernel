import Link from "next/link";

import { TOPICS, formatDate, readingMinutes, type Edition, type Story } from "@/lib/format";
import { siteUrl } from "@/lib/site";
import { Container } from "./Container";
import { ListenButton } from "./ListenButton";
import { ShareButtons } from "./ShareButtons";
import { SignupForm } from "./SignupForm";
import { StoryCard } from "./StoryCard";

type Section = { title: string; stories: { story: Story; rank: number }[] };

// Story of the day first, then the rest grouped by topic in brief order.
function sections(stories: Story[]): Section[] {
  const rest: Section[] = [];
  stories.slice(1).forEach((story, i) => {
    const title = story.kind === "model_release" ? "Model releases" : `Top in ${TOPICS[story.topic] ?? story.topic}`;
    let section = rest.find((s) => s.title === title);
    if (!section) rest.push((section = { title, stories: [] }));
    section.stories.push({ story, rank: i + 2 });
  });
  return rest;
}

export function EditionView({ edition, isLatest = false }: { edition: Edition; isLatest?: boolean }) {
  const now = Date.parse(edition.generated_at);
  const [first, ...others] = edition.stories;
  const sourceCount = new Set(edition.stories.flatMap((s) => s.sources.map((x) => x.name))).size;
  const minutes = readingMinutes(edition.stories);
  const groups = sections(edition.stories);
  const more = edition.feed.length - edition.stories.length;
  const url = `${siteUrl()}/brief/${edition.date}`;
  const listen = [
    `ReadKernel, ${formatDate(edition.date)}.`,
    ...edition.stories.map((s, i) => `${i + 1}. ${s.headline}. ${s.summary}`),
  ];

  return (
    <Container>
      <header className="mb-8">
        <p className="font-mono text-xs tracking-wide text-label uppercase">
          {isLatest ? "Today's brief" : "Daily brief"}
        </p>
        <h1 className="mt-1 text-4xl font-extrabold tracking-tight sm:text-5xl">{formatDate(edition.date)}</h1>
        <p className="mt-2 text-sm text-muted">
          {edition.stories.length} stories from {sourceCount} sources · about {minutes} min read
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <ListenButton parts={listen} label="Listen to this brief" />
          <ShareButtons url={url} title={`ReadKernel · ${formatDate(edition.date)}`} />
        </div>
      </header>

      {first && (
        <section aria-labelledby="story-of-the-day">
          <h2 id="story-of-the-day" className="mb-3 font-mono text-xs tracking-wide text-label uppercase">
            ★ Story of the day
          </h2>
          <StoryCard story={first} now={now} variant="lead" />
        </section>
      )}

      {groups.map((group, i) => (
        <section key={group.title} className="mt-8" aria-label={group.title}>
          <h2 className="mb-1 font-mono text-xs tracking-wide text-label uppercase">{group.title}</h2>
          {group.stories.map(({ story, rank }) => (
            <StoryCard key={story.story_key ?? story.headline} story={story} now={now} rank={rank} />
          ))}
          {i === 0 && others.length > 2 && (
            <div className="mt-6" id="subscribe">
              <SignupForm compact />
            </div>
          )}
        </section>
      ))}

      <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6 text-sm">
        <Link href="/brief" className="text-muted hover:text-ink">
          ← All briefs
        </Link>
        {more > 0 && (
          <Link href="/feed" className="font-medium text-accent hover:underline">
            {more} more stories in the feed →
          </Link>
        )}
      </div>
    </Container>
  );
}
