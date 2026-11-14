import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/Container";

export const metadata: Metadata = {
  title: "Roadmap",
  description: "What we're building next for ReadKernel: measuring quality, smarter ranking, search by meaning and rising topics.",
};

const PLANS = [
  {
    status: "Next",
    title: "Measure how good it is",
    body: "Right now we tune ReadKernel by eye. Next we're building a test set of real articles, checked by hand, to measure how often it merges the right stories, how often a summary says something its sources don't, and how many of those slips the fact-checker catches. The numbers will go on a public Quality page.",
  },
  {
    status: "Planned",
    title: "Rank by what readers find useful",
    body: "Today's order comes from a fixed formula: how many outlets covered a story, how much we trust them, and how fresh it is. We want to learn the order instead, from which stories people actually open, and run an A/B test to prove the new order is better. Anonymous counts only, no reader profiles.",
  },
  {
    status: "Planned",
    title: "Search by meaning",
    body: "Search and Ask match words today. We'll add search by meaning, so \"chip export rules\" also finds \"semiconductor restrictions\", and track how often the right story comes back first.",
  },
  {
    status: "Later",
    title: "Spot rising topics",
    body: "Notice when a company or topic suddenly gets far more coverage than usual, and show it in a Rising this week section before it's everywhere.",
  },
];

export default function RoadmapPage() {
  return (
    <Container>
      <p className="text-sm font-semibold text-label">Roadmap</p>
      <h1 className="mt-1 text-4xl font-extrabold tracking-tight">What we&apos;re building next</h1>
      <p className="mt-3 leading-relaxed text-muted">
        ReadKernel works today. These are the next four things we want it to do better, roughly in this order.
      </p>

      <ol className="mt-8 space-y-4">
        {PLANS.map((plan, i) => (
          <li key={plan.title} className="rounded-xl border border-line bg-card p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted tabular-nums">{i + 1}</span>
              <h2 className="text-lg font-bold">{plan.title}</h2>
              <span
                className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  plan.status === "Next" ? "bg-accent-soft text-accent" : "bg-sunk text-muted"
                }`}
              >
                {plan.status}
              </span>
            </div>
            <p className="mt-2 leading-relaxed text-muted">{plan.body}</p>
          </li>
        ))}
      </ol>

      <p className="mt-8 text-sm text-muted">
        Have an idea, or something you&apos;d like first?{" "}
        <Link href="/contact" className="font-medium text-accent hover:underline">
          Tell us
        </Link>
        .
      </p>
    </Container>
  );
}
