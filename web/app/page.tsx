/* eslint-disable @next/next/no-img-element -- source icons from Google's icon service */
import Link from "next/link";

import { CompanyPostCard } from "@/components/CompanyPostCard";
import { Container } from "@/components/Container";
import { SignupForm } from "@/components/SignupForm";
import { StoryCard } from "@/components/StoryCard";
import { faviconUrl, formatDate, getLatestEdition } from "@/lib/brief";
import { highlights, listCompanyPosts } from "@/lib/companies";
import { readingMinutes } from "@/lib/format";
import { FEATURED_SOURCES, SOURCES } from "@/lib/sources";

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
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b-2 border-ink pb-2 text-sm">
          <span className="font-semibold">{edition ? formatDate(edition.date) : "The daily brief"}</span>
          <span className="text-muted">
            {edition
              ? `${edition.stories.length} stories · ${sourceCount} sources · ${readingMinutes(edition.stories)} min read`
              : `${SOURCES.length} sources, read every morning`}
          </span>
        </div>

        <div className="grid gap-8 border-b border-line py-8 lg:grid-cols-[1fr_24rem] lg:gap-12 lg:py-10">
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

      {/* Where the news comes from, and the other ways to read it */}
      <Container size="wide" className="pt-14">
        <div className="grid gap-x-12 gap-y-8 border-t-2 border-ink pt-6 lg:grid-cols-2">
          <section aria-labelledby="sources-heading">
            <h2 id="sources-heading" className="text-[0.9375rem] font-bold">
              Reading {SOURCES.length} sources, including
            </h2>
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2.5">
              {FEATURED_SOURCES.map((s) => (
                <li key={s.name} className="flex items-center gap-2 text-sm">
                  <img src={faviconUrl(s.site)} alt="" width={16} height={16} loading="lazy" referrerPolicy="no-referrer" className="h-4 w-4 rounded-sm" />
                  {s.name}
                </li>
              ))}
              <li className="text-sm">
                <Link href="/sources" className="text-accent hover:underline">
                  and {SOURCES.length - FEATURED_SOURCES.length} more
                </Link>
              </li>
            </ul>
          </section>
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
