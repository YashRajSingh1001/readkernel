import type { MetadataRoute } from "next";

import { getLatestEdition, listEditions } from "@/lib/brief";
import { siteUrl } from "@/lib/site";

// Tells search engines which pages exist.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = siteUrl();
  const [editions, latest] = await Promise.all([listEditions(365), getLatestEdition()]);
  const updated = latest ? new Date(latest.generated_at) : new Date(0);

  return [
    { url: `${site}/`, lastModified: updated, changeFrequency: "daily", priority: 1 },
    { url: `${site}/feed`, lastModified: updated, changeFrequency: "daily", priority: 0.9 },
    { url: `${site}/brief`, lastModified: updated, changeFrequency: "daily", priority: 0.7 },
    { url: `${site}/how-it-works`, changeFrequency: "monthly", priority: 0.5 },
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
