import type { Metadata } from "next";
import { Source_Code_Pro, Source_Sans_3, Source_Serif_4 } from "next/font/google";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { THEME_SCRIPT } from "@/components/ThemeToggle";
import "./globals.css";

// Type: Source Serif 4 for headlines and story text (with its optical-size axis, so big
// headlines get the display cut), Source Sans 3 for the interface, Source Code Pro only for code.
const serif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
});
const sans = Source_Sans_3({ variable: "--font-source-sans", subsets: ["latin"] });
const mono = Source_Code_Pro({ variable: "--font-source-code", subsets: ["latin"], preload: false });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL || "http://localhost:3000"),
  alternates: { types: { "application/rss+xml": "/rss.xml" } },
  openGraph: { siteName: "ReadKernel", type: "website", locale: "en_IN" },
  twitter: { card: "summary" },
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
      className={`${serif.variable} ${sans.variable} ${mono.variable} antialiased`}
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
