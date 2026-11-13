import Link from "next/link";

import { Logo } from "./Logo";

const COLUMNS = [
  {
    title: "Read",
    links: [
      { href: "/today", label: "Today's brief" },
      { href: "/feed", label: "Feed" },
      { href: "/feed/top", label: "Top articles" },
      { href: "/brief", label: "Archive" },
      { href: "/search", label: "Search" },
      { href: "/saved", label: "Saved" },
    ],
  },
  {
    title: "Make it yours",
    links: [
      { href: "/brief/customize", label: "Build your brief" },
      { href: "/#subscribe", label: "Subscribe" },
      { href: "/rss.xml", label: "RSS" },
      { href: "/tools", label: "Chrome & AI assistants" },
      { href: "/ask", label: "Ask ReadKernel" },
    ],
  },
  {
    title: "Learn",
    links: [
      { href: "/how-it-works", label: "How it works" },
      { href: "/sources", label: "Sources" },
      { href: "/blog", label: "Blog" },
      { href: "/guides", label: "Guides" },
      { href: "/newsletters", label: "Newsletter reviews" },
      { href: "/compare", label: "Compare" },
    ],
  },
  {
    title: "ReadKernel",
    links: [
      { href: "/contact", label: "Contact" },
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line bg-sunk">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-muted">
            The day&apos;s tech and AI news, boiled down to the stories that matter. Free, with every source linked.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h2 className="mb-2 text-sm font-semibold text-muted">{col.title}</h2>
            <ul className="space-y-1.5 text-sm">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="hover:text-accent">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="mx-auto max-w-6xl px-4 pb-8 text-xs text-muted sm:px-6">
        Summaries are written by AI from public news feeds and can contain mistakes. Every story links to its original
        sources. Photos belong to the publishers credited.
      </div>
    </footer>
  );
}
