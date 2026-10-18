"use client";

// Saved stories live in the reader's own browser (localStorage), so no account
// is needed. A signed-in reader's list is also kept in Supabase (saved_stories,
// visible only to them) and merged with the browser's list, so it follows
// them across devices.

import { useSyncExternalStore } from "react";

import { supabaseBrowser } from "./supabase/browser";

export type SavedStory = {
  key: string;
  headline: string;
  topic: string;
  url: string; // lead source
  source: string;
  savedAt: string;
};

const STORAGE_KEY = "readkernel:saved:v1";
const EMPTY: SavedStory[] = [];
const listeners = new Set<() => void>();
let cache: SavedStory[] | null = null;

function read(): SavedStory[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    cache = Array.isArray(parsed) ? parsed : [];
  } catch {
    cache = []; // private mode or blocked storage: start empty
  }
  return cache;
}

function write(next: SavedStory[]) {
  cache = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // storage full or blocked: keep it in memory for this visit
  }
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      cache = null; // another tab changed it
      fn();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}

export function useSaved(): SavedStory[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

type Row = { story_key: string; headline: string; topic: string; url: string; source: string; saved_at: string };
const toRow = (s: SavedStory, userId: string) => ({
  user_id: userId,
  story_key: s.key,
  headline: s.headline,
  topic: s.topic,
  url: s.url,
  source: s.source,
  saved_at: s.savedAt,
});

async function signedInUserId(): Promise<string | null> {
  const supabase = supabaseBrowser();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

export function toggleSaved(story: Omit<SavedStory, "savedAt">) {
  const current = read();
  const removing = current.some((s) => s.key === story.key);
  const entry = { ...story, savedAt: new Date().toISOString() };
  write(removing ? current.filter((s) => s.key !== story.key) : [entry, ...current]);

  // Mirror to the account in the background; the browser copy is already updated.
  void (async () => {
    const userId = await signedInUserId();
    const supabase = supabaseBrowser();
    if (!userId || !supabase) return;
    if (removing) await supabase.from("saved_stories").delete().eq("user_id", userId).eq("story_key", story.key);
    else await supabase.from("saved_stories").upsert(toRow(entry, userId));
  })();
}

/** After sign-in: merge the browser's list and the account's list, both ways. */
export async function syncSavedWithAccount(): Promise<void> {
  const userId = await signedInUserId();
  const supabase = supabaseBrowser();
  if (!userId || !supabase) return;
  const { data, error } = await supabase.from("saved_stories").select("story_key,headline,topic,url,source,saved_at");
  if (error) return;
  const remote: SavedStory[] = (data as Row[]).map((r) => ({
    key: r.story_key,
    headline: r.headline,
    topic: r.topic,
    url: r.url,
    source: r.source,
    savedAt: r.saved_at,
  }));
  const local = read();
  const merged = new Map<string, SavedStory>();
  for (const s of [...remote, ...local]) merged.set(s.key, s);
  const all = [...merged.values()].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  write(all);
  const missing = local.filter((s) => !remote.some((r) => r.key === s.key));
  if (missing.length) await supabase.from("saved_stories").upsert(missing.map((s) => toRow(s, userId)));
}
