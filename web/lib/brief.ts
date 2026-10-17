// Reads briefs for the website.
// With SUPABASE_URL + SUPABASE_PUBLISHABLE_KEY set it reads the database;
// otherwise it reads the pipeline's JSON files (pipeline/data), so the site
// works locally before any database exists.

import { promises as fs } from "fs";
import { cacheLife } from "next/cache";
import path from "path";

import { isValidDate, type Edition, type EditionSummary, type Story } from "./format";

export * from "./format";

function supabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url: url.replace(/\/$/, ""), key } : null;
}

async function rest<T>(query: string): Promise<T> {
  const db = supabase()!;
  const headers: Record<string, string> = { apikey: db.key };
  if (db.key.startsWith("eyJ")) headers.Authorization = `Bearer ${db.key}`; // legacy anon key
  const res = await fetch(`${db.url}/rest/v1/${query}`, { headers });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

type EditionRow = Omit<Edition, "stories"> & { stories: (Story & { position: number })[] };

const EDITION_SELECT =
  "select=date,generated_at,ai,stories(position,headline,summary,why_it_matters,topic,score,importance,published,sources)" +
  "&stories.order=position.asc";

function dataDir() {
  // Ignore hint: this folder is read at runtime, not bundled into the build.
  return process.env.LOCAL_DATA_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), "..", "pipeline", "data");
}

async function readLocal(file: string): Promise<Edition | null> {
  try {
    const raw = JSON.parse(await fs.readFile(path.join(dataDir(), file), "utf-8"));
    return { date: raw.date, generated_at: raw.generated_at, ai: raw.ai, stories: raw.stories };
  } catch {
    return null;
  }
}

export async function getLatestEdition(): Promise<Edition | null> {
  "use cache";
  cacheLife("minutes"); // the pipeline publishes a few times a day
  if (supabase()) {
    const rows = await rest<EditionRow[]>(`editions?${EDITION_SELECT}&order=date.desc&limit=1`);
    return rows[0] ?? null;
  }
  return readLocal("latest.json");
}

export async function getEdition(date: string): Promise<Edition | null> {
  "use cache";
  cacheLife("minutes"); // the pipeline publishes a few times a day
  if (!isValidDate(date)) return null; // also blocks path tricks in local mode
  if (supabase()) {
    const rows = await rest<EditionRow[]>(`editions?${EDITION_SELECT}&date=eq.${date}`);
    return rows[0] ?? null;
  }
  return readLocal(`brief-${date}.json`);
}

export async function listEditions(limit = 90): Promise<EditionSummary[]> {
  "use cache";
  cacheLife("minutes"); // the pipeline publishes a few times a day
  if (supabase()) {
    return rest<EditionSummary[]>(`editions?select=date,story_count&order=date.desc&limit=${limit}`);
  }
  let files: string[] = [];
  try {
    files = await fs.readdir(dataDir());
  } catch {
    return [];
  }
  const dates = files
    .map((f) => /^brief-(\d{4}-\d{2}-\d{2})\.json$/.exec(f)?.[1])
    .filter((d): d is string => Boolean(d))
    .sort()
    .reverse()
    .slice(0, limit);
  const editions = await Promise.all(dates.map((d) => readLocal(`brief-${d}.json`)));
  return editions
    .filter((e): e is Edition => e !== null)
    .map((e) => ({ date: e.date, story_count: e.stories.length }));
}

