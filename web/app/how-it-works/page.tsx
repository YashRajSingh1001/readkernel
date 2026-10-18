import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "How ReadKernel reads dozens of tech news sources, merges duplicate coverage, ranks what matters, and writes a short summary for each story.",
};

const STEPS = [
  {
    title: "Read",
    body: "Every morning ReadKernel checks about 30 trusted tech and AI news sources: big outlets, company blogs, security trackers, startup news and the Hacker News front page. Anything older than a day and a half, or that is clearly a deal, an ad or a gift guide, is set aside.",
  },
  {
    title: "Merge",
    body: "When several outlets report the same event, you shouldn't read it five times. ReadKernel compares every article with every other one, and when two are about the same launch, deal or incident, they become one story with all the links attached.",
  },
  {
    title: "Rank",
    body: "Stories covered by more sources, from more trusted outlets, and more recently, rise to the top. An AI editor then rates each one for how much it matters to people who work in tech, which pushes real news above filler.",
  },
  {
    title: "Summarise",
    body: "For each story an AI writes a plain headline, a two-to-three sentence summary and one line on why it matters, using only what the sources say. Every summary links back to the original articles, so you can always check the details.",
  },
  {
    title: "Deliver",
    body: "The top 10 become the daily brief, on the site and in your inbox at 6 AM India time. The full feed of about 30 stories is there when you want more.",
  },
];

const FAQ = [
  {
    q: "Is it free?",
    a: "Yes. No paywall, no account needed to read. The email is free too, and every email has a one-click unsubscribe.",
  },
  {
    q: "Can I trust the summaries?",
    a: "They're written only from the source articles, and every story links to them. AI can still get things wrong, so for anything important, open the original coverage. It's one tap away.",
  },
  {
    q: "What do you do with my email address?",
    a: "Send you the brief. Nothing else: no selling, no sharing, no tracking pixels.",
  },
  {
    q: "How is this different from an RSS reader?",
    a: "An RSS reader shows you everything, including the same story ten times. ReadKernel merges duplicates, ranks by importance and summarises, so a few minutes is enough.",
  },
];

export default function HowItWorks() {
  return (
    <>
      <p className="text-sm font-medium tracking-wide text-accent uppercase">How it works</p>
      <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
        From hundreds of articles to the ten that matter
      </h1>
      <p className="mt-3 max-w-2xl leading-relaxed text-muted">
        A few minutes each morning instead of an hour of tabs. Here&apos;s what happens before the brief reaches you.
      </p>

      <ol className="mt-8 space-y-6">
        {STEPS.map((step, i) => (
          <li key={step.title} className="grid grid-cols-[2.5rem_1fr] gap-3">
            <span className="font-serif text-3xl leading-none text-accent tabular-nums">{i + 1}</span>
            <div>
              <h2 className="font-serif text-xl font-semibold">{step.title}</h2>
              <p className="mt-1 leading-relaxed text-pretty">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <section className="mt-12">
        <h2 className="font-serif text-2xl font-semibold">Questions</h2>
        <div className="mt-4 divide-y divide-line border-y border-line">
          {FAQ.map((item) => (
            <details key={item.q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
                {item.q}
                <span className="text-muted transition-transform group-open:rotate-45" aria-hidden>+</span>
              </summary>
              <p className="mt-2 leading-relaxed text-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/" className="rounded-lg bg-ink px-4 py-2 font-medium text-paper hover:opacity-90">Read today&apos;s brief</Link>
        <Link href="/feed" className="rounded-lg border border-line px-4 py-2 font-medium hover:border-ink">Open the feed</Link>
      </div>
    </>
  );
}
