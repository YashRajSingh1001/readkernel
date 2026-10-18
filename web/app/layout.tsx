import type { Metadata } from "next";
import { Geist_Mono, Inter, Newsreader } from "next/font/google";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { THEME_SCRIPT } from "@/components/ThemeToggle";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const newsreader = Newsreader({ variable: "--font-newsreader", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL || "http://localhost:3000"),
  alternates: { types: { "application/rss+xml": "/rss.xml" } },
  title: { default: "ReadKernel: the day's tech and AI news, distilled", template: "%s · ReadKernel" },
  description:
    "ReadKernel reads 50+ tech and AI news sources every morning, merges duplicate coverage, and gives you the stories that matter with every source linked. Free, by email or on the web.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-theme is set before paint by THEME_SCRIPT (light unless the reader chose otherwise).
    // suppressHydrationWarning: that script and browser extensions change <html> attributes.
    <html
      lang="en"
      data-theme="light"
      className={`${inter.variable} ${newsreader.variable} ${geistMono.variable} antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-screen flex-col font-sans">
        <SiteHeader />
        <main className="flex-1 py-8 sm:py-10">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
