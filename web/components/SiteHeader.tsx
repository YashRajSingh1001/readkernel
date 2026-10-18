import Link from "next/link";

import { AccountButton } from "./AccountButton";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

const NAV = [
  { href: "/today", label: "Today" },
  { href: "/feed", label: "Feed" },
  { href: "/brief", label: "Archive" },
  { href: "/how-it-works", label: "How it works" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-5 text-sm text-muted md:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-ink">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <Link
            href="/search"
            aria-label="Search the archive"
            title="Search"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-sunk hover:text-ink"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </Link>
          <ThemeToggle />
          <AccountButton />
          <Link
            href="/#subscribe"
            className="ml-1 hidden rounded-full bg-ink px-3.5 py-1.5 text-sm font-medium text-paper hover:opacity-90 sm:inline-block"
          >
            Subscribe
          </Link>
        </div>
      </div>
      {/* Phone: the main links in a scrollable row */}
      <nav aria-label="Main" className="flex gap-5 overflow-x-auto border-t border-line px-4 py-2 text-sm text-muted md:hidden">
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} className="whitespace-nowrap hover:text-ink">
            {item.label}
          </Link>
        ))}
        <Link href="/#subscribe" className="whitespace-nowrap font-medium text-accent">
          Subscribe
        </Link>
      </nav>
    </header>
  );
}
