import type { Metadata } from "next";
import { Inter, Newsreader } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const newsreader = Newsreader({ variable: "--font-newsreader", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "ReadKernel: the day's tech news, distilled", template: "%s · ReadKernel" },
  description:
    "ReadKernel reads dozens of tech and AI news sources every day, merges duplicate coverage, and gives you the stories that matter with every source linked.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${newsreader.variable} antialiased`}>
      <body className="min-h-screen font-sans">
        <header className="border-b border-line">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
            <Link href="/" className="flex items-baseline gap-1.5" aria-label="ReadKernel home">
              <span className="h-2.5 w-2.5 translate-y-[-1px] rounded-full bg-accent" />
              <span className="font-serif text-2xl font-semibold tracking-tight">ReadKernel</span>
            </Link>
            <nav className="flex gap-5 text-sm text-muted">
              <Link href="/" className="hover:text-ink">Today</Link>
              <Link href="/brief" className="hover:text-ink">Archive</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>
        <footer className="border-t border-line">
          <div className="mx-auto max-w-3xl px-4 py-6 text-xs text-muted sm:px-6">
            Summaries are written from public news feeds. Every story links to its original sources.
          </div>
        </footer>
      </body>
    </html>
  );
}
