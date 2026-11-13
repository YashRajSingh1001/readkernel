"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/today", label: "Today" },
  { href: "/feed", label: "Feed" },
  { href: "/companies", label: "Company blogs" },
  { href: "/ask", label: "Ask" },
  { href: "/brief", label: "Archive" },
  { href: "/how-it-works", label: "How it works" },
];

// "/feed/ai" still counts as Feed; "/brief/2026-10-20" as Archive.
function isActive(path: string, href: string): boolean {
  return path === href || path.startsWith(`${href}/`);
}

/** The main links, with the current page in bold and underlined so you can see where you are. */
export function MainNav({ variant }: { variant: "desktop" | "phone" }) {
  const path = usePathname();

  if (variant === "phone") {
    return (
      <nav aria-label="Main" className="flex gap-5 overflow-x-auto [scrollbar-width:none] border-t border-line px-4 py-2 text-sm text-muted md:hidden">
        {NAV.map((item) => {
          const active = isActive(path, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`whitespace-nowrap border-b-2 pb-0.5 ${active ? "border-accent font-semibold text-ink" : "border-transparent hover:text-ink"}`}
            >
              {item.label}
            </Link>
          );
        })}
        <Link href="/#subscribe" className="whitespace-nowrap font-medium text-accent">
          Subscribe
        </Link>
      </nav>
    );
  }

  return (
    <nav aria-label="Main" className="hidden h-full items-stretch gap-5 text-sm text-muted md:flex">
      {NAV.map((item) => {
        const active = isActive(path, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center border-b-2 pt-0.5 ${active ? "border-accent font-semibold text-ink" : "border-transparent hover:text-ink"}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
