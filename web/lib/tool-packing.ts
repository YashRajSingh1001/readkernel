import { urlsIn } from "./ask-stream.ts";

export type Packed = { content: string; urls: string[]; cites: string[]; omitted: number };

const MIN_TEXT = 40;

const size = (value: unknown) => JSON.stringify(value).length;
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

export function collectCites(value: unknown, into: string[]): void {
  if (Array.isArray(value)) value.forEach((v) => collectCites(v, into));
  else if (isRecord(value)) {
    for (const [k, v] of Object.entries(value)) {
      if (k === "cite" && typeof v === "string") into.push(v);
      else collectCites(v, into);
    }
  }
}

function longestText(value: unknown, path: (string | number)[] = []): { path: (string | number)[]; length: number } | null {
  if (typeof value === "string") {
    return value.length > 2 * MIN_TEXT && !value.includes("://") ? { path, length: value.length } : null;
  }
  let best: { path: (string | number)[]; length: number } | null = null;
  const entries: [string | number, unknown][] = Array.isArray(value) ? value.map((v, i) => [i, v]) : isRecord(value) ? Object.entries(value) : [];
  for (const [k, v] of entries) {
    const found = longestText(v, [...path, k]);
    if (found && (!best || found.length > best.length)) best = found;
  }
  return best;
}

function shrink<T>(value: T, fits: (v: T) => boolean): T | null {
  let current = structuredClone(value);
  for (;;) {
    if (fits(current)) return current;
    const target = longestText(current);
    if (!target) return null;
    if (target.path.length === 0) {
      current = `${(current as string).slice(0, Math.floor(target.length / 2))}…` as T;
      continue;
    }
    let parent = current as unknown as Record<string | number, unknown>;
    for (const k of target.path.slice(0, -1)) parent = parent[k] as Record<string | number, unknown>;
    const key = target.path.at(-1)!;
    const text = parent[key] as string;
    parent[key] = `${text.slice(0, Math.floor(target.length / 2))}…`;
  }
}

function finish(value: unknown, omitted: number): Packed {
  const content = JSON.stringify(value);
  const urls = urlsIn(content);
  const sent = new Set(urls);
  const cites: string[] = [];
  collectCites(value, cites);
  return { content, urls, cites: cites.filter((c) => urlsIn(c).every((u) => sent.has(u))), omitted };
}

function countItems(value: Record<string, unknown>): number {
  return Object.values(value).reduce<number>((n, v) => n + (Array.isArray(v) ? v.length : 0), 0);
}

export function packToolResult(result: unknown, budget: number): Packed {
  if (result === undefined) return finish(null, 0);
  if (size(result) <= budget) return finish(result, 0);

  if (!isRecord(result)) {
    if (Array.isArray(result)) return packToolResult({ items: result }, budget);
    const cut = shrink(result, (v) => size(v) <= budget);
    return finish(cut ?? null, 0);
  }

  const total = countItems(result);
  const note = (omitted: number) =>
    omitted > 0
      ? { omitted_items: omitted, size_note: `${omitted} of ${total} items were left out to fit the size limit; this list is incomplete.` }
      : { size_note: "Some long text was shortened to fit the size limit." };
  const withNote = (body: Record<string, unknown>, omitted: number) => ({ ...body, ...note(omitted) });

  const keys = Object.keys(result).filter((k) => Array.isArray(result[k]));
  const base: Record<string, unknown> = { ...result };
  for (const k of keys) base[k] = [];
  const fitted = shrink(base, (b) => size(withNote(b, total)) <= budget);
  if (!fitted) {
    const fallback = { omitted_items: total, size_note: "This result was too large to show; try a narrower request." };
    return finish(size(fallback) <= budget ? fallback : {}, total);
  }

  const body = structuredClone(fitted);
  let omitted = total;
  for (const k of keys) {
    const list = body[k] as unknown[];
    for (const item of result[k] as unknown[]) {
      const fits = (candidate: unknown) => {
        list.push(candidate);
        const ok = size(withNote(body, omitted - 1)) <= budget;
        list.pop();
        return ok;
      };
      const alone = size(withNote({ ...fitted, [k]: [item] }, total - 1)) > budget;
      const kept = fits(item) ? item : alone ? shrink(item, fits) : null;
      if (kept === null) continue;
      list.push(kept);
      omitted--;
    }
  }
  return finish(withNote(body, omitted), omitted);
}

type PackableMessage = { role: string; content: string | null; result?: unknown };

export function packMessages<M extends PackableMessage>(messages: M[], budget: number): { messages: M[]; urls: string[]; cites: string[] } {
  const urls: string[] = [];
  const cites: string[] = [];
  const packed = messages.map((m): M => {
    if (m.role !== "tool") return m;
    if (m.result === undefined) {
      urls.push(...urlsIn(m.content ?? ""));
      return m;
    }
    const p = packToolResult(m.result, budget);
    urls.push(...p.urls);
    cites.push(...p.cites);
    return { ...m, content: p.content };
  });
  return { messages: packed, urls, cites };
}
