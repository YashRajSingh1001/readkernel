import { getLatestEdition } from "@/lib/brief";
import { siteUrl } from "@/lib/site";

// RSS for feed readers: today's brief, one item per story.
function xml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const site = siteUrl();
  const edition = await getLatestEdition();
  const items = (edition?.stories ?? [])
    .map((s) => {
      const link = s.story_key ? `${site}/story/${s.story_key}` : (s.sources[0]?.url ?? site);
      const body = [s.summary, s.why_it_matters && `Why it matters: ${s.why_it_matters}`].filter(Boolean).join(" ");
      return `    <item>
      <title>${xml(s.headline)}</title>
      <link>${xml(link)}</link>
      <guid isPermaLink="${s.story_key ? "true" : "false"}">${xml(link)}</guid>
      <pubDate>${new Date(s.published).toUTCString()}</pubDate>
      <category>${xml(s.topic)}</category>
      <description>${xml(body)}</description>
    </item>`;
    })
    .join("\n");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>ReadKernel</title>
    <link>${xml(site)}</link>
    <description>The day's tech and AI news, distilled.</description>
    <language>en</language>
${items}
  </channel>
</rss>`;

  return new Response(body, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
