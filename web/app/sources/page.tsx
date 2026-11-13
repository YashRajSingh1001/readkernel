/* eslint-disable @next/next/no-img-element -- source icons from Google's icon service */
import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/Container";
import { TOPICS, TOPIC_BLURBS, domainOf, faviconUrl } from "@/lib/format";
import { SOURCES } from "@/lib/sources";

export const metadata: Metadata = {
  title: "Sources",
  description: `Every news source ReadKernel reads each morning: ${SOURCES.length} outlets, labs, blogs and trackers across AI, tech, developers, startups, security, markets and design.`,
};

export default function SourcesPage() {
  return (
    <Container>
      <p className="text-sm font-semibold text-label">Sources</p>
      <h1 className="mt-1 text-4xl font-extrabold tracking-tight">What we read, every morning</h1>
      <p className="mt-3 leading-relaxed text-muted">
        ReadKernel checks these {SOURCES.length} sources each day. We pick sources that report first-hand (the labs
        and companies themselves), outlets with a record of accurate reporting, and a few community sources where
        developers talk. Want one added or removed?{" "}
        <Link href="/contact" className="text-accent hover:underline">
          Tell us
        </Link>
        .
      </p>

      {Object.keys(TOPICS).map((topic) => {
        const list = SOURCES.filter((s) => s.topic === topic);
        if (list.length === 0) return null;
        return (
          <section key={topic} className="mt-10">
            <h2 className="flex items-baseline gap-2 text-xl font-bold">
              {TOPICS[topic]} <span className="text-sm font-normal text-muted">{list.length}</span>
            </h2>
            <p className="text-sm text-muted">{TOPIC_BLURBS[topic]}</p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {list.map((s) => (
                <li key={s.name}>
                  <a
                    href={s.site}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-lg border border-line bg-card px-3 py-2.5 hover:border-ink"
                  >
                    <img src={faviconUrl(s.site)} alt="" width={20} height={20} loading="lazy" referrerPolicy="no-referrer" className="h-5 w-5 rounded" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{s.name}</span>
                      <span className="block truncate text-xs text-muted">{domainOf(s.site)}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </Container>
  );
}
