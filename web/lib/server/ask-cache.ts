import "server-only";

// Answers to Ask's suggested questions, stored in Supabase (ask_answers, from
// db/migrations/007) so each costs one AI run per story per day instead of one
// per reader. Next's in-memory cache wouldn't help here: on Vercel each request
// can land on a fresh instance. Until the migration has run, every lookup
// misses and nothing is stored, so Ask works exactly as before.

import type { AskStep } from "../ask-stream";
import { adminConfigured, adminRest } from "./admin-db";

export type CachedAnswer = { answer: string; steps: AskStep[] };

// ASK_CACHE=off skips the table entirely and ASK_CACHE=read never writes to it,
// for trying Ask locally against the live database without storing test answers.
const mode = () => process.env.ASK_CACHE ?? "on";

/** The edition date is part of the key: "How has this developed?" changes daily. */
export function askCacheKey(editionDate: string, question: string, storyKey?: string): string {
  return `${editionDate}|${storyKey ?? "-"}|${question}`;
}

export async function readCachedAnswer(key: string): Promise<CachedAnswer | null> {
  if (!adminConfigured() || mode() === "off") return null;
  try {
    const rows = await adminRest<CachedAnswer[]>(`ask_answers?select=answer,steps&key=eq.${encodeURIComponent(key)}&limit=1`);
    return rows?.[0] ?? null;
  } catch (err) {
    console.warn("[ask-cache] read skipped (run db/migrations/007?)", String(err).slice(0, 160));
    return null;
  }
}

export async function saveCachedAnswer(key: string, value: CachedAnswer): Promise<void> {
  if (!adminConfigured() || mode() !== "on") return;
  try {
    await adminRest("ask_answers", {
      method: "POST",
      body: { key, answer: value.answer, steps: value.steps },
      prefer: "resolution=ignore-duplicates,return=minimal",
    });
  } catch (err) {
    console.warn("[ask-cache] save skipped (run db/migrations/007?)", String(err).slice(0, 160));
  }
}
