import { promises as fs } from "fs";
import { cacheLife } from "next/cache";
import path from "path";

import {
  COMPANY_SLUG_RE,
  companySlug,
  isValidDate,
  type CompanyLink,
  type CompanyTag,
  type Discussion,
  type Edition,
  type EditionSummary,
  type Story,
  type StoryWithDate,
} from "./format";

export * from "./format";

const STORY_KEY_RE = /^[a-z0-9-]{6,40}$/;

export function supabase() {
  if (process.env.READ_LOCAL_DATA === "1") return null;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url: url.replace(/\/$/, ""), key } : null;
}

export async function rest<T>(query: string): Promise<T> {
  const db = supabase()!;
  const headers: Record<string, string> = { apikey: db.key };
  if (db.key.startsWith("eyJ")) headers.Authorization = `Bearer ${db.key}`;
  const res = await fetch(`${db.url}/rest/v1/${query}`, { headers });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

const STORY_COLUMNS =
  "story_key,brief_position,position,headline,summary,why_it_matters,topic,kind,score,importance," +
  "published,image_url,image_credit,thread_id,sources";
const DISCUSSION_COLUMNS = "position,title,url,comments_url,source,points,comments,summary";

type StoryRow = Story & { position: number };
type EditionRow = {
  date: string;
  generated_at: string;
  ai: string | null;
  stories: StoryRow[];
  discussions?: (Discussion & { position: number })[];
};

const EDITION_SELECT =
  `select=date,generated_at,ai,stories(${STORY_COLUMNS}),discussions(${DISCUSSION_COLUMNS})` +
  "&stories.order=position.asc&discussions.order=position.asc";

function toEdition(row: EditionRow): Edition {
  const feed = row.stories;
  const stories = feed
    .filter((s) => s.brief_position != null)
    .sort((a, b) => (a.brief_position ?? 0) - (b.brief_position ?? 0));
  return { date: row.date, generated_at: row.generated_at, ai: row.ai, stories, feed, discussions: row.discussions ?? [] };
}

export function dataDir() {
  return process.env.LOCAL_DATA_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), "..", "pipeline", "data");
}

async function readLocal(file: string): Promise<Edition | null> {
  try {
    const raw = JSON.parse(await fs.readFile(path.join(dataDir(), file), "utf-8"));
    return {
      date: raw.date,
      generated_at: raw.generated_at,
      ai: raw.ai,
      stories: raw.stories,
      feed: raw.feed ?? raw.stories,
      discussions: raw.discussions ?? [],
    };
  } catch {
    return null;
  }
}

export async function getLatestEdition(): Promise<Edition | null> {
  "use cache";
  cacheLife("minutes");
  if (supabase()) {
    const rows = await rest<EditionRow[]>(`editions?${EDITION_SELECT}&order=date.desc&limit=1`);
    return rows[0] ? toEdition(rows[0]) : null;
  }
  return readLocal("latest.json");
}

export async function getEdition(date: string): Promise<Edition | null> {
  "use cache";
  cacheLife("minutes");
  if (!isValidDate(date)) return null;
  if (supabase()) {
    const rows = await rest<EditionRow[]>(`editions?${EDITION_SELECT}&date=eq.${date}`);
    return rows[0] ? toEdition(rows[0]) : null;
  }
  return readLocal(`brief-${date}.json`);
}

export async function listEditions(limit = 90): Promise<EditionSummary[]> {
  "use cache";
  cacheLife("minutes");
  if (supabase()) {
    const rows = await rest<(EditionSummary & { stories: { headline: string }[] })[]>(
      `editions?select=date,story_count,stories(headline)&stories.brief_position=eq.1&order=date.desc&limit=${limit}`,
    );
    return rows.map(({ stories, ...e }) => ({ ...e, lead: stories[0]?.headline }));
  }
  const dates = (await localDates()).slice(0, limit);
  const editions = await Promise.all(dates.map((d) => readLocal(`brief-${d}.json`)));
  return editions
    .filter((e): e is Edition => e !== null)
    .map((e) => ({ date: e.date, story_count: e.stories.length, lead: e.stories[0]?.headline }));
}

export async function previousEditionDate(date: string): Promise<string | null> {
  const editions = await listEditions(120);
  return editions.find((e) => e.date < date)?.date ?? null;
}

export async function getStory(key: string): Promise<StoryWithDate | null> {
  "use cache";
  cacheLife("minutes");
  if (!STORY_KEY_RE.test(key)) return null;
  if (supabase()) {
    const rows = await rest<StoryWithDate[]>(
      `stories?select=edition_date,${STORY_COLUMNS}&story_key=eq.${key}&order=edition_date.desc&limit=1`,
    );
    return rows[0] ?? null;
  }
  for (const date of (await localDates()).slice(0, 14)) {
    const edition = await readLocal(`brief-${date}.json`);
    const story = edition?.feed.find((s) => s.story_key === key);
    if (story) return { ...story, edition_date: date };
  }
  return null;
}

export async function getThread(threadId: string): Promise<StoryWithDate[]> {
  "use cache";
  cacheLife("minutes");
  if (!STORY_KEY_RE.test(threadId)) return [];
  let rows: StoryWithDate[] = [];
  if (supabase()) {
    rows = await rest<StoryWithDate[]>(
      `stories?select=edition_date,${STORY_COLUMNS}&or=(thread_id.eq.${threadId},story_key.eq.${threadId})` +
        `&order=edition_date.desc,score.desc&limit=60`,
    );
  } else {
    for (const date of (await localDates()).slice(0, 30)) {
      const edition = await readLocal(`brief-${date}.json`);
      for (const s of edition?.feed ?? [])
        if (s.thread_id === threadId || s.story_key === threadId) rows.push({ ...s, edition_date: date });
    }
  }
  const perDay = new Map<string, StoryWithDate>();
  for (const r of rows) if (!perDay.has(r.edition_date)) perDay.set(r.edition_date, r);
  return [...perDay.values()];
}

export async function searchStories(query: string, limit = 40): Promise<StoryWithDate[]> {
  "use cache";
  cacheLife("minutes");
  const q = query.trim().slice(0, 100);
  if (q.length < 2) return [];
  if (supabase()) {
    return rest<StoryWithDate[]>(
      `stories?select=edition_date,${STORY_COLUMNS}&search=wfts(english).${encodeURIComponent(q)}` +
        `&order=edition_date.desc,score.desc&limit=${limit}`,
    );
  }
  const words = q.toLowerCase().split(/\s+/);
  const found: StoryWithDate[] = [];
  for (const date of await localDates()) {
    const edition = await readLocal(`brief-${date}.json`);
    for (const s of edition?.feed ?? []) {
      const text = `${s.headline} ${s.summary}`.toLowerCase();
      if (words.every((w) => text.includes(w))) found.push({ ...s, edition_date: date });
    }
    if (found.length >= limit) break;
  }
  return found.slice(0, limit);
}

async function localDates(): Promise<string[]> {
  try {
    const files = await fs.readdir(dataDir());
    return files
      .map((f) => /^brief-(\d{4}-\d{2}-\d{2})\.json$/.exec(f)?.[1])
      .filter((d): d is string => Boolean(d))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

type TagRow = { edition_date: string; story_key: string; company: string; name: string };

const COMPANY_STORY_LIMIT = 40;

function tagsOf(story: Story | undefined): CompanyTag[] {
  return (story?.companies ?? []).map((name) => ({ slug: companySlug(name), name }));
}

export async function getStoryCompanies(storyKey: string, date: string): Promise<CompanyTag[]> {
  "use cache";
  cacheLife("minutes");
  if (!STORY_KEY_RE.test(storyKey) || !isValidDate(date)) return [];
  if (supabase()) {
    try {
      const rows = await rest<TagRow[]>(
        `story_companies?select=company,name&story_key=eq.${storyKey}&edition_date=eq.${date}`,
      );
      return rows.map((r) => ({ slug: r.company, name: r.name }));
    } catch {
      return [];
    }
  }
  const edition = await readLocal(`brief-${date}.json`);
  return tagsOf(edition?.feed.find((s) => s.story_key === storyKey));
}

export type CompanyNews = {
  slug: string;
  name: string;
  stories: StoryWithDate[];
  often: CompanyLink[];
};

export async function getCompanyNews(slug: string): Promise<CompanyNews | null> {
  "use cache";
  cacheLife("minutes");
  if (!COMPANY_SLUG_RE.test(slug)) return null;
  let stories: StoryWithDate[] = [];
  let tags: TagRow[] = [];

  if (supabase()) {
    try {
      const mine = await rest<TagRow[]>(
        `story_companies?select=edition_date,story_key,company,name&company=eq.${slug}` +
          `&order=edition_date.desc&limit=${COMPANY_STORY_LIMIT * 2}`,
      );
      const newest = new Map<string, string>();
      for (const r of mine) if (!newest.has(r.story_key)) newest.set(r.story_key, r.edition_date);
      const keys = [...newest.keys()].slice(0, COMPANY_STORY_LIMIT);
      if (keys.length === 0) return null;
      const list = keys.join(",");
      const [rows, others] = await Promise.all([
        rest<StoryWithDate[]>(`stories?select=edition_date,${STORY_COLUMNS}&story_key=in.(${list})&order=edition_date.desc,score.desc`),
        rest<TagRow[]>(`story_companies?select=edition_date,story_key,company,name&story_key=in.(${list})&company=neq.${slug}`),
      ]);
      const current = (r: { story_key?: string; edition_date: string }) => newest.get(r.story_key ?? "") === r.edition_date;
      stories = rows.filter(current);
      tags = [...mine, ...others].filter(current);
    } catch {
      return null;
    }
  } else {
    const seen = new Set<string>();
    for (const date of (await localDates()).slice(0, 60)) {
      const edition = await readLocal(`brief-${date}.json`);
      for (const s of edition?.feed ?? []) {
        const own = tagsOf(s);
        if (!s.story_key || seen.has(s.story_key) || !own.some((t) => t.slug === slug)) continue;
        seen.add(s.story_key);
        stories.push({ ...s, edition_date: date });
        tags.push(...own.map((t) => ({ edition_date: date, story_key: s.story_key!, company: t.slug, name: t.name })));
      }
      if (stories.length >= COMPANY_STORY_LIMIT) break;
    }
    if (stories.length === 0) return null;
  }

  const spellings = new Map<string, number>();
  for (const t of tags) if (t.company === slug) spellings.set(t.name, (spellings.get(t.name) ?? 0) + 1);
  const name = [...spellings.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? slug;

  const shared = new Map<string, { name: string; keys: Set<string> }>();
  for (const t of tags) {
    if (t.company === slug) continue;
    const entry = shared.get(t.company) ?? { name: t.name, keys: new Set<string>() };
    entry.keys.add(t.story_key);
    shared.set(t.company, entry);
  }
  const often = [...shared.entries()]
    .map(([s, e]) => ({ slug: s, name: e.name, stories: e.keys.size }))
    .sort((a, b) => b.stories - a.stories || a.name.localeCompare(b.name))
    .slice(0, 8);

  return { slug, name, stories: stories.slice(0, COMPANY_STORY_LIMIT), often };
}

export async function listRecentCompanies(days = 30, limit = 200): Promise<CompanyLink[]> {
  "use cache";
  cacheLife("hours");
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  let tags: TagRow[] = [];
  if (supabase()) {
    try {
      tags = await rest<TagRow[]>(`story_companies?select=story_key,company,name&edition_date=gte.${since}&limit=5000`);
    } catch {
      return [];
    }
  } else {
    for (const date of await localDates()) {
      if (date < since) break;
      const edition = await readLocal(`brief-${date}.json`);
      for (const s of edition?.feed ?? []) {
        for (const t of tagsOf(s)) tags.push({ edition_date: date, story_key: s.story_key ?? "", company: t.slug, name: t.name });
      }
    }
  }
  const counts = new Map<string, { name: string; keys: Set<string> }>();
  for (const t of tags) {
    const entry = counts.get(t.company) ?? { name: t.name, keys: new Set<string>() };
    entry.keys.add(t.story_key);
    counts.set(t.company, entry);
  }
  return [...counts.entries()]
    .map(([slug, e]) => ({ slug, name: e.name, stories: e.keys.size }))
    .sort((a, b) => b.stories - a.stories)
    .slice(0, limit);
}
