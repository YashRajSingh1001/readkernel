import { promises as fs } from "fs";
import { cacheLife } from "next/cache";
import path from "path";

import { dataDir, rest, supabase } from "./brief";

export type ExplainerStep = { text: string; quote: string };

export type Explainer = {
  slug: string;
  week_of: string;
  story_key: string;
  title: string;
  body: {
    what_it_is: string;
    steps: ExplainerStep[];
    whats_new: string;
    limits: string;
    try_it: string;
  };
  source_name: string;
  source_url: string;
  approved_at: string;
};

const SLUG_RE = /^[a-z0-9-]{1,80}$/;
const COLUMNS = "slug,week_of,story_key,title,body,source_name,source_url,approved_at";

export async function listExplainers(): Promise<Explainer[]> {
  "use cache";
  cacheLife("minutes");
  try {
    if (supabase()) {
      return await rest<Explainer[]>(`explainers?select=${COLUMNS}&status=eq.approved&order=approved_at.desc&limit=200`);
    }
    const rows = JSON.parse(await fs.readFile(path.join(dataDir(), "explainers.json"), "utf-8")) as (Explainer & {
      status: string;
    })[];
    return rows
      .filter((r) => r.status === "approved" && r.approved_at)
      .sort((a, b) => b.approved_at.localeCompare(a.approved_at));
  } catch {
    return [];
  }
}

export async function getExplainer(slug: string): Promise<Explainer | null> {
  if (!SLUG_RE.test(slug)) return null;
  return (await listExplainers()).find((e) => e.slug === slug) ?? null;
}

export async function getStoryExplainer(storyKey: string): Promise<Explainer | null> {
  return (await listExplainers()).find((e) => e.story_key === storyKey) ?? null;
}
