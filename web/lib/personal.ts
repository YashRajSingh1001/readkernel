// "Make it yours" rules. Mirrors pipeline/kernel/personal.py exactly, so the
// builder's live preview shows what the reader's email will contain.
import type { Story } from "./format";

export const COUNTS = [5, 10, 15] as const;
export const FORMATS = [
  { id: "summaries", label: "Summaries", hint: "What happened and why it matters" },
  { id: "headlines", label: "Headlines only", hint: "Scan it in under a minute" },
  { id: "images", label: "With photos", hint: "Summaries plus a photo for each story" },
] as const;
export const FREQUENCIES = [
  { id: "daily", label: "Every morning" },
  { id: "weekly", label: "Once a week (Sunday)" },
] as const;

// companyRead: end the email with one engineering post from a company blog (see /companies).
export type Prefs = { topics: string[]; count: number; format: string; frequency: string; companyRead: boolean };
export const DEFAULT_PREFS: Prefs = { topics: [], count: 10, format: "summaries", frequency: "daily", companyRead: true };

export function selectStories(brief: Story[], feed: Story[], topics: string[], count: number): Story[] {
  const n = (COUNTS as readonly number[]).includes(count) ? count : 10;
  const byScore = [...feed].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  if (topics.length === 0) {
    const picked = brief.slice(0, n);
    const keys = new Set(picked.map((s) => s.story_key ?? s.headline));
    for (const s of byScore) {
      if (picked.length >= n) break;
      if (!keys.has(s.story_key ?? s.headline)) picked.push(s);
    }
    return picked;
  }
  const wanted = new Set(topics);
  return byScore.filter((s) => wanted.has(s.topic)).slice(0, n);
}

/** Validate untrusted form input into Prefs. */
export function parsePrefs(
  input: { topics?: unknown; count?: unknown; format?: unknown; frequency?: unknown; companyRead?: unknown },
  validTopics: string[],
): Prefs {
  const topics = String(input.topics ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter((t) => validTopics.includes(t));
  const count = Number(input.count);
  const format = String(input.format ?? "");
  const frequency = String(input.frequency ?? "");
  return {
    topics: [...new Set(topics)],
    count: (COUNTS as readonly number[]).includes(count) ? count : 10,
    format: FORMATS.some((f) => f.id === format) ? format : "summaries",
    frequency: FREQUENCIES.some((f) => f.id === frequency) ? frequency : "daily",
    companyRead: String(input.companyRead ?? "1") !== "0",
  };
}
