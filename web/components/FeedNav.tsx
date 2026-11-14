"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { TOPICS } from "@/lib/format";

type Props = { counts: Record<string, number>; total: number; discussions: number };

const icon = {
  home: "M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  top: "M4 18 9 12l4 4 7-9M14 7h6v6",
  saved: "M6 3h12v18l-6-4-6 4z",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm9 16-3.5-3.5",
  companies: "M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16M14 10h5a1 1 0 0 1 1 1v10M3 21h18M8 8h2M8 12h2M8 16h2",
};

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

export function FeedNav({ counts, total, discussions }: Props) {
  const path = usePathname();
  const item = (href: string, label: string, count?: number, d?: string) => {
    const active = path === href;
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm ${
          active ? "bg-ink font-semibold text-paper" : "text-muted hover:bg-sunk hover:text-ink"
        }`}
      >
        {d && <Icon d={d} />}
        <span className="flex-1">{label}</span>
        {count != null && <span className="text-xs opacity-70 tabular-nums">{count}</span>}
      </Link>
    );
  };

  return (
    <>
      <nav aria-label="Feed" className="sticky top-20 hidden w-52 shrink-0 self-start lg:block">
        {item("/feed", "All stories", total, icon.home)}
        <p className="mt-4 mb-1 px-3 text-xs font-semibold text-muted">Topics</p>
        {Object.keys(TOPICS)
          .filter((t) => counts[t])
          .map((t) => item(`/feed/${t}`, TOPICS[t], counts[t]))}
        <p className="mt-4 mb-1 px-3 text-xs font-semibold text-muted">More</p>
        {item("/feed/top", "Top articles", discussions, icon.top)}
        {item("/companies", "Company blogs", undefined, icon.companies)}
        {item("/saved", "Saved", undefined, icon.saved)}
        {item("/search", "Search", undefined, icon.search)}
      </nav>

      <nav
        aria-label="Feed"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        {[
          { href: "/feed", label: "Feed", d: icon.home },
          { href: "/feed/top", label: "Top articles", d: icon.top },
          { href: "/saved", label: "Saved", d: icon.saved },
          { href: "/search", label: "Search", d: icon.search },
        ].map((b) => (
          <Link
            key={b.href}
            href={b.href}
            aria-current={path === b.href ? "page" : undefined}
            className={`flex flex-col items-center gap-0.5 py-2 text-[11px] ${path === b.href ? "text-accent" : "text-muted"}`}
          >
            <Icon d={b.d} />
            {b.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
