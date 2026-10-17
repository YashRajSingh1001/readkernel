import { formatDate, type Edition } from "@/lib/format";
import { StoryList } from "./StoryList";

type Props = { edition: Edition; title?: string; children?: React.ReactNode };

// `children` render between the heading and the stories (e.g. the sign-up box).
export function EditionView({ edition, title, children }: Props) {
  const sourceCount = new Set(edition.stories.flatMap((s) => s.sources.map((x) => x.name))).size;

  return (
    <>
      <div className="mb-6">
        <p className="text-sm font-medium tracking-wide text-accent uppercase">
          {title ?? "Today's brief"}
        </p>
        <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
          {formatDate(edition.date)}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {edition.stories.length} stories, from {sourceCount} sources.
        </p>
      </div>
      {children}
      {/* "Ago" times are measured from when the brief was made, so pages stay cacheable. */}
      <StoryList stories={edition.stories} now={Date.parse(edition.generated_at)} />
    </>
  );
}
