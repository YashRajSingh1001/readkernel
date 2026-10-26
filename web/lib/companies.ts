// Reads company blog posts (written by pipeline/kernel/company_blogs.py):
// from Supabase when configured, otherwise from pipeline/data/company_posts.json.

import { promises as fs } from "fs";
import { cacheLife } from "next/cache";
import path from "path";

import { dataDir, rest, supabase } from "./brief";
import list from "./companies.json";
import type { CompanyPost } from "./format";

export type CompanyInfo = { name: string; site: string };

/** Every company we read. Generated from pipeline/company_blogs.yaml by `python -m kernel.company_blogs --export-web`. */
export const COMPANIES: CompanyInfo[] = list;

const COLUMNS ="url,link,title,company,published,summary,category,depth,score,image_url,hn_points,found_via,added_at";

/** The newest posts (a few months' worth); pages filter and sort these. */
export async function listCompanyPosts(limit = 400): Promise<CompanyPost[]> {
  "use cache";
  cacheLife("minutes");
  try {
    if (supabase()) {
      return await rest<CompanyPost[]>(`company_posts?select=${COLUMNS}&order=published.desc&limit=${limit}`);
    }
    const raw = await fs.readFile(path.join(dataDir(), "company_posts.json"), "utf-8");
    return (JSON.parse(raw) as CompanyPost[]).slice(0, limit);
  } catch (err) {
    // Before the first pipeline run (or before migration 005) there is simply nothing yet.
    console.error("[companies]", err instanceof Error ? err.message : err);
    return [];
  }
}

/** Announcements and marketing (depth 1) stay hidden unless asked for. */
export function isWorthReading(post: CompanyPost): boolean {
  return post.depth == null || post.depth >= 2;
}

/** The best reads of the latest `days` (counted back from the newest post), at most one per company. */
export function highlights(posts: CompanyPost[], count = 3, days = 7): CompanyPost[] {
  const newest = Math.max(0, ...posts.map((p) => Date.parse(p.published)));
  const since = newest - days * 86_400_000;
  const picked: CompanyPost[] = [];
  const companies = new Set<string>();
  const recent = posts
    .filter((p) => Date.parse(p.published) >= since && (p.depth == null || p.depth >= 3))
    .sort((a, b) => b.score - a.score);
  for (const post of recent) {
    if (picked.length >= count) break;
    if (companies.has(post.company)) continue;
    companies.add(post.company);
    picked.push(post);
  }
  return picked;
}

export async function searchCompanyPosts(query: string, limit = 20): Promise<CompanyPost[]> {
  "use cache";
  cacheLife("minutes");
  const q = query.trim().slice(0, 100);
  if (q.length < 2) return [];
  if (supabase()) {
    try {
      return await rest<CompanyPost[]>(
        `company_posts?select=${COLUMNS}&search=wfts(english).${encodeURIComponent(q)}&order=published.desc&limit=${limit}`,
      );
    } catch {
      return [];
    }
  }
  const words = q.toLowerCase().split(/\s+/);
  return (await listCompanyPosts())
    .filter((p) => words.every((w) => `${p.title} ${p.summary} ${p.company}`.toLowerCase().includes(w)))
    .slice(0, limit);
}
