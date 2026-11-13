import Link from "next/link";

import { CompanyPostCard } from "@/components/CompanyPostCard";
import { Container } from "@/components/Container";
import { SignupForm } from "@/components/SignupForm";
import { SourcesStrip } from "@/components/SourcesStrip";
import { StoryCard } from "@/components/StoryCard";
import { formatDate, getLatestEdition } from "@/lib/brief";
import { highlights, listCompanyPosts } from "@/lib/companies";
import { formatTimeIST, readingMinutes } from "@/lib/format";
import { SOURCES } from "@/lib/sources";

/**
 * The front page reads like a newspaper's: today's edition first, the pitch
 * kept to a sentence and a sign-up box. The longer explanation lives on
 * /how-it-works.
 */
export default async function Home() {
  const [edition, companyPosts] = await Promise.all([getLatestEdition(), listCompanyPosts()]);
  const [first, ...rest] = edition?.stories ?? [];
  const companyReads = highlights(companyPosts, 3);
  const now = edition ? Date.parse(edition.generated_at) : 0;
  const sourceCount = edition ? new Set(edition.stories.flatMap((s) => s.sources.map((x) => x.name))).size : 0;

  return (
    <>
      {/* Masthead: what this is, and the sign-up, on the first screen */}
      <Container size="wide">
        {/* Dateline: the edition's date, when it was published, and what's in it */}
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-1 border-b-2 border-ink pb-3">
          <p className="font-serif text-xl font-semibold sm:text-2xl">
            {edition ? formatDate(edition.date, "full") : "The daily brief"}
          </p>
          {edition && (
            <p className="text-[0.9375rem] text-muted tabular-nums">
              <span className="whitespace-nowrap">Published {formatTimeIST(edition.generated_at)}</span>
              <span aria-hidden> · </span>
              <span className="whitespace-nowrap">
                {edition.stories.length} stories from {sourceCount} sources
              </span>
              <span aria-hidden> · </span>
              <span className="whitespace-nowrap">{readingMinutes(edition.stories)}-minute read</span>
            </p>
          )}
        </div>

        <div className="grid gap-8 py-8 lg:grid-cols-[1fr_24rem] lg:gap-12">
          <div>
            <h1 className="max-w-3xl text-4xl title-serif text-balance sm:text-5xl">
              Today&apos;s tech and AI news, boiled down to ten stories.
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-pretty text-muted">
              Every morning ReadKernel reads {SOURCES.length} sources, merges the stories everyone is covering, and
              explains each one in a few lines, with every source linked.{" "}
              <Link href="/how-it-works" className="text-ink underline decoration-line underline-offset-2 hover:decoration-ink">
                How it works
              </Link>
              .
            </p>
          </div>
          <div id="subscribe" className="scroll-mt-24 lg:border-l lg:border-line lg:pl-12">
            <h2 className="font-serif text-xl font-semibold">Get it by email</h2>
            <p className="mt-1 mb-4 text-sm text-muted">One email at 6 AM IST. Free, and one click to unsubscribe.</p>
            <SignupForm stacked />
            <p className="mt-3 text-sm text-muted">
              Or{" "}
              <Link href="/brief/customize" className="text-ink underline decoration-line underline-offset-2 hover:decoration-ink">
                choose your topics and length
              </Link>{" "}
              first.
            </p>
          </div>
        </div>
        <SourcesStrip sources={SOURCES} />
      </Container>

      {/* Today's brief: the lead story large, the next five as a numbered list */}
      {edition && first ? (
        <Container size="wide" className="pt-10">
          <div className="grid gap-10 lg:grid-cols-[1.55fr_1fr] lg:gap-12">
            <section aria-labelledby="lead-story">
              <h2 id="lead-story" className="mb-4 section-rule">
                Story of the day
              </h2>
              <StoryCard story={first} now={now} variant="lead" />
            </section>
            <section aria-labelledby="also-today">
              <h2 id="also-today" className="section-rule">
                Also in today&apos;s brief
              </h2>
              <div>
                {rest.slice(0, 5).map((s, i) => (
                  <StoryCard key={s.story_key ?? s.headline} story={s} now={now} rank={i + 2} variant="compact" showImage={false} />
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium">
                <Link href="/today" className="text-accent hover:underline">
                  Read all {edition.stories.length} stories
                </Link>
                <Link href="/feed" className="text-muted hover:text-ink">
                  The full feed
                </Link>
              </div>
            </section>
          </div>
        </Container>
      ) : (
        <Container size="wide" className="pt-10">
          <p className="text-muted">
            Today&apos;s brief isn&apos;t out yet. It lands at 6 AM IST.{" "}
            <Link href="/brief" className="text-accent hover:underline">
              Read a past brief
            </Link>
            .
          </p>
        </Container>
      )}

      {/* Company blogs */}
      {companyReads.length > 0 && (
        <Container size="wide" className="pt-14">
          <div className="grid gap-x-12 gap-y-4 lg:grid-cols-[1fr_1.55fr]">
            <div>
              <h2 className="section-rule">From company blogs</h2>
              <p className="mt-3 font-serif text-2xl leading-snug font-semibold text-balance">How real companies build</p>
              <p className="mt-2 text-muted">
                Engineering write-ups straight from the teams, each summarised in a line or two.
              </p>
              <Link href="/companies" className="mt-3 inline-block text-sm font-medium text-accent hover:underline">
                All company posts
              </Link>
            </div>
            <div className="border-t border-line lg:border-t-0">
              {companyReads.map((p) => (
                <CompanyPostCard key={p.url} post={p} variant="compact" />
              ))}
            </div>
          </div>
        </Container>
      )}

      {/* The other ways to read it */}
      <Container size="wide" className="pt-14">
        <div className="max-w-3xl border-t-2 border-ink pt-6">
          <section aria-labelledby="elsewhere-heading">
            <h2 id="elsewhere-heading" className="text-[0.9375rem] font-bold">
              Read it where you work
            </h2>
            <p className="mt-3 leading-relaxed text-pretty text-muted">
              Add one address to Claude or Cursor and ask &ldquo;what&apos;s the AI news today?&rdquo;, or get the
              brief in every new Chrome tab. There&apos;s also an{" "}
              <Link href="/rss.xml" className="text-ink underline decoration-line underline-offset-2 hover:decoration-ink">
                RSS feed
              </Link>{" "}
              and a{" "}
              <Link href="/search" className="text-ink underline decoration-line underline-offset-2 hover:decoration-ink">
                searchable archive
              </Link>
              .
            </p>
            <Link href="/tools" className="mt-3 inline-block text-sm font-medium text-accent hover:underline">
              Set up Claude, Cursor or Chrome
            </Link>
          </section>
        </div>
      </Container>
    </>
  );
}
