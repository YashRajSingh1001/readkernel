import type { MetadataRoute } from "next";

import { TOPICS, getLatestEdition, listEditions } from "@/lib/brief";
import { listEntries } from "@/lib/content";
import { siteUrl } from "@/lib/site";

// Tells search engines which pages exist.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = siteUrl();
  const [editions, latest, blog, guides, reviews] = await Promise.all([
    listEditions(365),
    getLatestEdition(),
    listEntries("blog"),
    listEntries("guides"),
    listEntries("newsletters"),
  ]);
  const updated = latest ? new Date(latest.generated_at) : new Date(0);

  return [
    { url: `${site}/`, lastModified: updated, changeFrequency: "daily", priority: 1 },
    { url: `${site}/feed`, lastModified: updated, changeFrequency: "daily", priority: 0.9 },
    { url: `${site}/brief`, lastModified: updated, changeFrequency: "daily", priority: 0.7 },
    { url: `${site}/today`, lastModified: updated, changeFrequency: "daily", priority: 0.9 },
    { url: `${site}/feed/top`, lastModified: updated, changeFrequency: "daily", priority: 0.7 },
    ...Object.keys(TOPICS).map((t) => ({ url: `${site}/feed/${t}`, lastModified: updated, priority: 0.7 })),
    ...["companies", "how-it-works", "sources", "brief/customize", "blog", "guides", "newsletters", "compare", "contact", "privacy", "terms"].map(
      (p) => ({ url: `${site}/${p}`, changeFrequency: "monthly" as const, priority: 0.5 }),
    ),
    ...blog.map((e) => ({ url: `${site}/blog/${e.slug}`, lastModified: new Date(e.date), priority: 0.5 })),
    ...guides.map((e) => ({ url: `${site}/guides/${e.slug}`, lastModified: new Date(e.date), priority: 0.5 })),
    ...reviews.map((e) => ({ url: `${site}/newsletters/${e.slug}`, lastModified: new Date(e.date), priority: 0.5 })),
    ...editions.map((e) => ({
      url: `${site}/brief/${e.date}`,
      lastModified: new Date(`${e.date}T00:00:00Z`),
      changeFrequency: "never" as const,
      priority: 0.6,
    })),
    ...(latest?.feed ?? [])
      .filter((s) => s.story_key)
      .map((s) => ({ url: `${site}/story/${s.story_key}`, lastModified: updated, priority: 0.6 })),
  ];
}
