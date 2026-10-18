"use client";

// Saved stories live in the reader's own browser (localStorage): no account
// needed, nothing stored on our side. A small snapshot of each story is kept so
// the Saved page works even after the story leaves the feed.

import { useSyncExternalStore } from "react";

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

export function toggleSaved(story: Omit<SavedStory, "savedAt">) {
  const current = read();
  write(
    current.some((s) => s.key === story.key)
      ? current.filter((s) => s.key !== story.key)
      : [{ ...story, savedAt: new Date().toISOString() }, ...current],
  );
}
