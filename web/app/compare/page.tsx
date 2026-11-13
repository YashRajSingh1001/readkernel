import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/Container";

export const metadata: Metadata = {
  title: "Compare",
  description: "ReadKernel compared with the other ways people keep up with tech news: news sites, RSS readers, newsletters, social feeds and AI chat.",
};

const ROWS: { way: string; good: string; catch: string; readkernel: string }[] = [
  {
    way: "News sites and aggregators",
    good: "Everything, as it happens",
    catch: "The same story ten times; no sense of what matters most",
    readkernel: "Merges duplicate coverage into one story and ranks by importance",
  },
  {
    way: "RSS reader",
    good: "You choose every source",
    catch: "Shows everything, unmerged; you do the sorting",
    readkernel: "Reads 50+ sources for you and picks the top ten; also offers an RSS feed",
  },
  {
    way: "Newsletters",
    good: "Curated by a person, often with a point of view",
    catch: "Several inboxes, overlapping links, mostly fixed topics",
    readkernel: "One email, your topics, 5/10/15 stories, daily or weekly",
  },
  {
    way: "X, LinkedIn and other social feeds",
    good: "Fast, with reactions from people you follow",
    catch: "Rewards speed and outrage; hard to tell signal from noise",
    readkernel: "Settled facts the next morning, with every source linked",
  },
  {
    way: "Asking an AI chatbot",
    good: "Conversational, can explain",
    catch: "May not know today's news, and rarely shows where facts came from",
    readkernel: "Summaries written only from today's articles, with the articles attached",
  },
];

export default function ComparePage() {
  return (
    <Container>
      <p className="text-sm font-semibold text-label">Compare</p>
      <h1 className="mt-1 text-4xl font-extrabold tracking-tight">How ReadKernel compares</h1>
      <p className="mt-3 leading-relaxed text-muted">
        Every way of keeping up with tech has a trade-off. Here&apos;s where ReadKernel fits, honestly. Many readers use it
        alongside one or two of these.
      </p>

      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-ink text-left">
              <th className="py-2 pr-4 font-semibold">Way to keep up</th>
              <th className="py-2 pr-4 font-semibold">Good at</th>
              <th className="py-2 pr-4 font-semibold">The catch</th>
              <th className="py-2 font-semibold text-accent">What ReadKernel does</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.way} className="border-b border-line align-top">
                <td className="py-3 pr-4 font-medium">{r.way}</td>
                <td className="py-3 pr-4 text-muted">{r.good}</td>
                <td className="py-3 pr-4 text-muted">{r.catch}</td>
                <td className="py-3">{r.readkernel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="prose-rk mt-10">
        <h2>Where ReadKernel is not the right fit</h2>
        <ul>
          <li>
            <strong>You need news the minute it breaks.</strong> We publish once each morning, so live trading or incident
            response needs a real-time source.
          </li>
          <li>
            <strong>You want deep analysis.</strong> We tell you what happened in a few lines. For the why, pair us with a
            thoughtful newsletter. See our <Link href="/newsletters">reviews</Link>.
          </li>
          <li>
            <strong>You follow a niche closely.</strong> If you live inside one specialist field, its own community will
            always be ahead of a general brief.
          </li>
        </ul>
      </section>
    </Container>
  );
}
