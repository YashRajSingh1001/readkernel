import { promises as fs } from "fs";
import { marked } from "marked";
import { cacheLife } from "next/cache";
import path from "path";

export type Kind = "blog" | "guides" | "newsletters";

export type Entry = {
  slug: string;
  title: string;
  description: string;
  date: string;
  meta: Record<string, string>;
  html: string;
};

const SLUG_RE = /^[a-z0-9-]{2,80}$/;

function dir(kind: Kind) {
  return path.join(/*turbopackIgnore: true*/ process.cwd(), "content", kind);
}

function parse(slug: string, raw: string): Entry {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  const meta: Record<string, string> = {};
  for (const line of (match?.[1] ?? "").split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  const body = match?.[2] ?? raw;
  return {
    slug,
    title: meta.title ?? slug,
    description: meta.description ?? "",
    date: meta.date ?? "",
    meta,
    html: marked.parse(body, { async: false }) as string,
  };
}

export async function listEntries(kind: Kind): Promise<Entry[]> {
  "use cache";
  cacheLife("hours");
  let files: string[] = [];
  try {
    files = await fs.readdir(dir(kind));
  } catch {
    return [];
  }
  const entries = await Promise.all(
    files
      .filter((f) => f.endsWith(".md"))
      .map(async (f) => parse(f.replace(/\.md$/, ""), await fs.readFile(path.join(dir(kind), f), "utf-8"))),
  );
  return entries.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));
}

export async function getEntry(kind: Kind, slug: string): Promise<Entry | null> {
  "use cache";
  cacheLife("hours");
  if (!SLUG_RE.test(slug)) return null;
  try {
    return parse(slug, await fs.readFile(path.join(dir(kind), `${slug}.md`), "utf-8"));
  } catch {
    return null;
  }
}
