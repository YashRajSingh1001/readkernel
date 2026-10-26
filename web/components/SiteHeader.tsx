import Link from "next/link";

import { AccountButton } from "./AccountButton";
import { Logo } from "./Logo";
import { MainNav } from "./MainNav";
import { ThemeToggle } from "./ThemeToggle";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Logo />
        <MainNav variant="desktop" />
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
      <MainNav variant="phone" />
    </header>
  );
}
