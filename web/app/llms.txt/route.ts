import { TOPICS, formatDate, getLatestEdition } from "@/lib/brief";
import { siteUrl } from "@/lib/site";
import { NEWS_TOOLS } from "@/lib/tools";

// /llms.txt (https://llmstxt.org): a plain-Markdown map of ReadKernel for AI agents and
// LLM crawlers, with where to get the data and today's ten headlines.
export async function GET() {
  const site = siteUrl();
  const edition = await getLatestEdition();

  const today = edition
    ? [
        `## Today's brief: ${formatDate(edition.date)}`,
        "",
        ...edition.stories.map((s, i) => {
          const url = s.story_key ? `${site}/story/${s.story_key}` : (s.sources[0]?.url ?? site);
          const sources = new Set(s.sources.map((x) => x.name)).size;
          return `${i + 1}. [${s.headline}](${url}) (${TOPICS[s.topic] ?? s.topic}, ${sources} ${sources === 1 ? "source" : "sources"}): ${s.summary}`;
        }),
        "",
      ]
    : [];

  const body = [
    "# ReadKernel",
    "",
    "> A free daily brief of the most important tech and AI news. Every morning ReadKernel reads dozens of news " +
      "sources, merges duplicate coverage of the same event into one story, ranks the stories and writes a short " +
      "summary of each. Every story links to all of its original sources. Summaries are written by AI and can " +
      "contain mistakes, so cite the original sources for anything important.",
    "",
    ...today,
    "## Data for agents",
    "",
    `- [MCP server](${site}/tools): streamable HTTP at ${site}/mcp, no key needed. Tools: ${NEWS_TOOLS.map((t) => t.name).join(", ")}`,
    `- [Today's brief as JSON](${site}/api/v1/today): ranked stories with summaries, topics and source links; CORS open, cached 5 minutes`,
    `- [RSS](${site}/rss.xml): today's brief, one item per story`,
    "",
    "## Pages",
    "",
    `- [Today's brief](${site}/today): the ten most important stories of the day`,
    `- [Feed](${site}/feed): all of the day's stories, by topic`,
    `- [Archive](${site}/brief): every past brief, at ${site}/brief/YYYY-MM-DD`,
    `- [Company blogs](${site}/companies): engineering write-ups from company blogs, summarised`,
    `- [Sources](${site}/sources): every outlet ReadKernel reads`,
    `- [How it works](${site}/how-it-works): how stories are merged, ranked and summarised`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=300, s-maxage=300" },
  });
}
