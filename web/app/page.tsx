/* eslint-disable @next/next/no-img-element -- source icons from Google's icon service */
import Link from "next/link";

import { CompanyPostCard } from "@/components/CompanyPostCard";
import { Container } from "@/components/Container";
import { SignupForm } from "@/components/SignupForm";
import { StoryCard } from "@/components/StoryCard";
import { faviconUrl, formatDate, getLatestEdition } from "@/lib/brief";
import { highlights, listCompanyPosts } from "@/lib/companies";
import { FEATURED_SOURCES, SOURCES } from "@/lib/sources";

const STEPS = [
  {
    n: "1",
    title: "Read everything",
    body: `Every morning we check ${SOURCES.length} trusted sources: big outlets, AI labs, developer blogs, security trackers and India's startup press.`,
  },
  {
    n: "2",
    title: "Merge and rank",
    body: "Five articles about the same launch become one story with every link attached. The ones that matter most rise to the top.",
  },
  {
    n: "3",
    title: "Explain it simply",
    body: "Each story gets a plain headline, two or three sentences of facts, and one line on why it matters. Read it in five minutes.",
  },
];

const PERKS = [
  { title: "Every story has its own page", body: "Summary, all the coverage and share buttons, without bouncing between ten tabs." },
  { title: "Built with India in mind", body: "Indian startup and market sources, and the brief lands at 6 AM IST." },
  { title: "Developers and security get their own lanes", body: "Not buried under gadget news." },
  { title: "Save without an account", body: "Bookmarks live in your browser. Sign in only if you want them everywhere." },
  { title: "Listen instead of reading", body: "One tap and your browser reads the brief aloud." },
  { title: "Search every past brief", body: "Find that story from last week in seconds." },
];

export default async function Home() {
  const [edition, companyPosts] = await Promise.all([getLatestEdition(), listCompanyPosts()]);
  const [first, ...rest] = edition?.stories ?? [];
  const companyReads = highlights(companyPosts, 3);
  const now = edition ? Date.parse(edition.generated_at) : 0;

  return (
    <>
      {/* Hero */}
      <Container size="wide" className="pt-6 pb-14 text-center sm:pt-12">
        <p className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1 font-mono text-xs text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-label" /> Free · every morning · every source linked
        </p>
        <h1 className="mx-auto mt-6 max-w-4xl text-4xl leading-[1.05] font-extrabold tracking-tight text-balance sm:text-6xl">
          Today&apos;s tech and AI news, boiled down to ten stories.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-pretty text-muted">
          ReadKernel reads {SOURCES.length} sources each morning, merges the stories everyone is covering, and explains
          each one in a few lines. In your inbox by 6 AM IST.
        </p>
        <div id="subscribe" className="mx-auto mt-8 max-w-xl scroll-mt-24">
          <SignupForm />
          <p className="mt-3 text-xs text-muted">Free. One email a day. Unsubscribe with one click.</p>
        </div>
        <div className="mt-6 flex justify-center gap-6 text-sm font-medium">
          <Link href="/today" className="hover:text-accent">
            Read today&apos;s brief →
          </Link>
          <Link href="/feed" className="hover:text-accent">
            Open the feed →
          </Link>
        </div>
      </Container>

      {/* Sources */}
      <section className="border-y border-line bg-sunk py-6">
        <Container size="wide">
          <p className="text-center font-mono text-xs tracking-wide text-muted uppercase">
            Reading {SOURCES.length} sources, including
          </p>
          <ul className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-3">
            {FEATURED_SOURCES.map((s) => (
              <li key={s.name} className="flex items-center gap-2 text-sm font-medium">
                <img src={faviconUrl(s.site)} alt="" width={16} height={16} loading="lazy" referrerPolicy="no-referrer" className="h-4 w-4 rounded" />
                {s.name}
              </li>
            ))}
            <li className="text-sm">
              <Link href="/sources" className="text-accent hover:underline">
                + {SOURCES.length - FEATURED_SOURCES.length} more
              </Link>
            </li>
          </ul>
        </Container>
      </section>

      {/* Today's brief preview */}
      {edition && first && (
        <Container className="py-14">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="font-mono text-xs tracking-wide text-label uppercase">Today&apos;s brief</p>
              <h2 className="mt-1 text-3xl font-extrabold tracking-tight">{formatDate(edition.date)}</h2>
            </div>
            <Link href="/today" className="hidden text-sm font-medium text-accent hover:underline sm:inline">
              Read the full edition →
            </Link>
          </div>
          <div className="mt-6 rounded-2xl border border-line bg-card p-4 sm:p-6">
            <p className="mb-3 font-mono text-xs tracking-wide text-label uppercase">★ Story of the day</p>
            <StoryCard story={first} now={now} variant="lead" />
            <div className="mt-2">
              {rest.slice(0, 3).map((s) => (
                <StoryCard key={s.story_key ?? s.headline} story={s} now={now} variant="compact" />
              ))}
            </div>
            <Link href="/today" className="mt-4 block text-center text-sm font-medium text-accent hover:underline">
              + {Math.max(0, edition.stories.length - 4)} more in today&apos;s edition
            </Link>
          </div>
        </Container>
      )}

      {/* Company blogs */}
      {companyReads.length > 0 && (
        <Container className="pb-14">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="font-mono text-xs tracking-wide text-label uppercase">From company blogs</p>
              <h2 className="mt-1 text-3xl font-extrabold tracking-tight">How real companies build</h2>
            </div>
            <Link href="/companies" className="hidden text-sm font-medium text-accent hover:underline sm:inline">
              All company posts →
            </Link>
          </div>
          <div className="mt-6 rounded-2xl border border-line bg-card px-4 sm:px-6">
            {companyReads.map((p) => (
              <CompanyPostCard key={p.url} post={p} variant="compact" />
            ))}
          </div>
          <Link href="/companies" className="mt-4 block text-center text-sm font-medium text-accent hover:underline sm:hidden">
            All company posts →
          </Link>
        </Container>
      )}

      {/* ReadKernel everywhere: AI assistants (MCP), Chrome, Ask */}
      <Container className="pb-14">
        <Link
          href="/tools"
          className="group grid gap-5 rounded-2xl border border-line bg-card p-6 hover:border-ink sm:grid-cols-[1fr_auto] sm:items-center sm:p-8"
        >
          <div>
            <p className="font-mono text-xs tracking-wide text-label uppercase">ReadKernel everywhere</p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight">Use ReadKernel in Claude, Cursor or Chrome</h2>
            <ul className="mt-3 space-y-1.5 text-sm text-muted">
              <li>
                <span className="font-medium text-ink">AI assistants:</span> add one address and ask Claude or Cursor
                &ldquo;what&apos;s the AI news today?&rdquo;
              </li>
              <li>
                <span className="font-medium text-ink">Chrome:</span> today&apos;s brief in every new tab.
              </li>
            </ul>
          </div>
          <span className="text-sm font-semibold text-accent group-hover:underline">Set it up →</span>
        </Link>
      </Container>

      {/* How it works */}
      <section className="border-t border-line bg-sunk py-14">
        <Container size="wide">
          <p className="text-center font-mono text-xs tracking-wide text-label uppercase">How it works</p>
          <h2 className="mt-1 text-center text-3xl font-extrabold tracking-tight">From hundreds of articles to ten stories</h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {STEPS.map((step) => (
              <li key={step.n} className="rounded-2xl border border-line bg-card p-6">
                <span className="font-mono text-sm text-accent">0{step.n}</span>
                <h3 className="mt-2 text-xl font-bold">{step.title}</h3>
                <p className="mt-2 leading-relaxed text-muted">{step.body}</p>
                {step.n === "2" && (
                  <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-label-soft px-3 py-1 font-mono text-xs text-label">
                    5 articles → 1 story · 5 sources
                  </p>
                )}
              </li>
            ))}
          </ol>
          <p className="mt-8 text-center text-sm">
            <Link href="/how-it-works" className="text-accent hover:underline">
              The details, and what we do with your email →
            </Link>
          </p>
        </Container>
      </section>

      {/* Make it yours */}
      <Container size="wide" className="py-14">
        <div className="grid items-center gap-8 rounded-2xl border border-line bg-card p-6 sm:p-10 md:grid-cols-2">
          <div>
            <p className="font-mono text-xs tracking-wide text-label uppercase">Make it yours</p>
            <h2 className="mt-1 text-3xl font-extrabold tracking-tight">Your topics, your length, your format</h2>
            <p className="mt-3 leading-relaxed text-muted">
              Only care about AI and startups? Want five stories instead of ten, headlines only, or photos with every
              story? Daily or once a week? Build your brief and see today&apos;s email change as you click.
            </p>
            <Link
              href="/brief/customize"
              className="mt-5 inline-block rounded-full bg-ink px-5 py-2.5 font-semibold text-paper hover:opacity-90"
            >
              Build your brief →
            </Link>
          </div>
          <div className="grid gap-3 text-sm" aria-hidden>
            <div className="flex flex-wrap gap-2">
              {["AI", "Startups", "Developers"].map((t) => (
                <span key={t} className="rounded-full border border-ink bg-ink px-3 py-1 text-paper">
                  {t}
                </span>
              ))}
              {["Tech", "Security", "Markets", "Design"].map((t) => (
                <span key={t} className="rounded-full border border-line px-3 py-1 text-muted">
                  {t}
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              {["5", "10", "15"].map((n) => (
                <span key={n} className={`rounded-lg border px-4 py-2 ${n === "5" ? "border-ink font-semibold" : "border-line text-muted"}`}>
                  {n} stories
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {["Summaries", "Headlines only", "With photos"].map((f) => (
                <span key={f} className={`rounded-lg border px-3 py-2 ${f === "With photos" ? "border-ink font-semibold" : "border-line text-muted"}`}>
                  {f}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Container>

      {/* Why ReadKernel */}
      <Container size="wide" className="pb-6">
        <h2 className="text-center text-3xl font-extrabold tracking-tight">Why ReadKernel</h2>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PERKS.map((p) => (
            <li key={p.title} className="rounded-xl border border-line p-5">
              <h3 className="font-bold">{p.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{p.body}</p>
            </li>
          ))}
        </ul>
        <div className="mt-12 rounded-2xl bg-ink p-8 text-center text-paper sm:p-12">
          <h2 className="text-3xl font-extrabold tracking-tight">Five minutes. Everything that mattered.</h2>
          <p className="mt-2 opacity-80">Join the morning brief. It&apos;s free.</p>
          <Link href="#subscribe" className="mt-6 inline-block rounded-full bg-accent px-6 py-3 font-semibold text-white hover:opacity-90">
            Subscribe free
          </Link>
        </div>
      </Container>
    </>
  );
}
