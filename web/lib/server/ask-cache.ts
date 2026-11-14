import "server-only";

import type { AskStep } from "../ask-stream";
import { adminConfigured, adminRest } from "./admin-db";

export type CachedAnswer = { answer: string; steps: AskStep[] };

const mode = () => process.env.ASK_CACHE ?? "on";

export function askCacheKey(editionDate: string, question: string, storyKey?: string): string {
  return `v2|${editionDate}|${storyKey ?? "-"}|${question}`;
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
