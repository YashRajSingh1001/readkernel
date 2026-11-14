import { TOPICS, getLatestEdition } from "@/lib/brief";
import { highlights, listCompanyPosts } from "@/lib/companies";
import { COMPANY_CATEGORIES } from "@/lib/format";
import { siteUrl } from "@/lib/site";

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, max-age=300, s-maxage=300",
};

export async function GET() {
  const [edition, posts] = await Promise.all([getLatestEdition(), listCompanyPosts()]);
  if (!edition) return Response.json({ error: "No brief yet" }, { status: 404, headers: HEADERS });
  const site = siteUrl();

  return Response.json(
    {
      date: edition.date,
      generated_at: edition.generated_at,
      url: `${site}/brief/${edition.date}`,
      stories: edition.stories.map((s, i) => ({
        rank: i + 1,
        headline: s.headline,
        summary: s.summary,
        why_it_matters: s.why_it_matters,
        topic: TOPICS[s.topic] ?? s.topic,
        model_release: s.kind === "model_release",
        image_url: s.image_url ?? null,
        url: s.story_key ? `${site}/story/${s.story_key}` : s.sources[0]?.url,
        source_count: new Set(s.sources.map((x) => x.name)).size,
        sources: s.sources.slice(0, 3).map((x) => ({ name: x.name, url: x.url })),
      })),
      top_articles: edition.discussions.slice(0, 8).map((d) => ({
        title: d.title,
        summary: d.summary,
        points: d.points,
        url: d.url,
        discussion: d.comments_url,
      })),
      company_reads: highlights(posts, 3).map((p) => ({
        company: p.company,
        title: p.title,
        summary: p.summary,
        subject: COMPANY_CATEGORIES[p.category] ?? p.category,
        url: p.link,
      })),
    },
    { headers: HEADERS },
  );
}
