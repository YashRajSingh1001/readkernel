import type { Metadata } from "next";
import { Jost } from "next/font/google";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { THEME_SCRIPT } from "@/components/ThemeToggle";
import "./globals.css";

const jost = Jost({ variable: "--font-jost", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL || "http://localhost:3000"),
  alternates: { types: { "application/rss+xml": "/rss.xml" } },
  title: { default: "ReadKernel: the day's tech and AI news, distilled", template: "%s · ReadKernel" },
  description:
    "ReadKernel reads 50+ tech and AI news sources every morning, merges duplicate coverage, and gives you the stories that matter with every source linked. Free, by email or on the web.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="light"
      className={`${jost.variable} antialiased`}
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
