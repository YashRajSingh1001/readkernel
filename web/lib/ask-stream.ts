export type ToolCounts = {
  stories?: number;
  posts?: number;
  articles?: number;
  timeline?: number;
  date?: string;
  matched_query?: string;
  empty?: boolean;
  unavailable?: boolean;
  pages?: number;
};

export type AskStep = {
  tool: string;
  args: Record<string, unknown>;
  ok?: boolean;
  counts?: ToolCounts;
  error?: string;
};

export type AskEvent =
  | { type: "status"; phase: "thinking"; round: number }
  | { type: "status"; phase: "retry"; waitSeconds: number; reason: "rate_limited" | "server_error" }
  | { type: "status"; phase: "cached"; date: string }
  | { type: "tool"; id: string; state: "started"; tool: string; args: Record<string, unknown> }
  | { type: "tool"; id: string; state: "finished"; ok: boolean; args?: Record<string, unknown>; counts?: ToolCounts; error?: string }
  | { type: "note"; text: string }
  | { type: "delta"; text: string }
  | { type: "discard" }
  | { type: "citation"; url: string; label: string }
  | { type: "done"; answer: string; steps: AskStep[]; complete: boolean; cached: boolean; truncated: boolean }
  | { type: "error"; message: string; retryable: boolean; partial: boolean };

export const NDJSON = "application/x-ndjson";

export async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<AskEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (line) yield JSON.parse(line) as AskEvent;
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) yield JSON.parse(buffer) as AskEvent;
  } finally {
    reader.releaseLock();
  }
}

export function countResult(tool: string, result: unknown): ToolCounts {
  const r = (result ?? {}) as Record<string, unknown>;
  const len = (v: unknown) => (Array.isArray(v) ? v.length : undefined);
  const counts: ToolCounts = {};
  if (len(r.stories) !== undefined) counts.stories = len(r.stories);
  if (len(r.posts) !== undefined || len(r.company_blog_posts) !== undefined) {
    counts.posts = len(r.posts) ?? len(r.company_blog_posts);
  }
  if (len(r.articles) !== undefined) counts.articles = len(r.articles);
  if (len(r.timeline) !== undefined) counts.timeline = len(r.timeline);
  if (typeof r.date === "string" && tool !== "search_news") counts.date = r.date;
  if (typeof r.matched_query === "string") counts.matched_query = r.matched_query;
  if (Object.values(r).some((v) => (v as { unavailable?: unknown } | null)?.unavailable === true)) counts.unavailable = true;
  const found = (counts.stories ?? 0) + (counts.posts ?? 0) + (counts.articles ?? 0);
  if (r.story) counts.stories = 1;
  else if (found === 0 && !counts.unavailable && (typeof r.message === "string" || counts.stories !== undefined || counts.posts !== undefined)) {
    counts.empty = true;
  }
  return counts;
}

export function urlsIn(text: string): string[] {
  return text.match(/https?:\/\/[^\s"'<>\\)\]]+/g) ?? [];
}

const norm = (url: string) => url.replace(/[/.,;:]+$/, "");

export const OFF_TOPIC_MARKER = "OFF_TOPIC";
const BLOCKERS = [OFF_TOPIC_MARKER, "```"];
export const LINK_PATTERN = "\\[([^\\]\\n]{1,299})\\]\\((https?:\\/\\/[^\\s)]{1,1990})\\)";
const LINK = new RegExp(LINK_PATTERN, "g");

function couldBeLink(s: string): boolean {
  const m = /^\[([^\]\n]*)(\])?(\()?([^\s)]*)$/.exec(s);
  if (!m) return false;
  if (!m[2]) return m[1].length < 300;
  if (!m[3]) return s.length === m[1].length + 2;
  const url = m[4];
  return "https://".startsWith(url) || "http://".startsWith(url) || (/^https?:\/\//.test(url) && url.length < 2000);
}

export class AnswerGuard {
  private raw = "";
  private committed = 0;
  private shown = "";
  private cited = new Set<string>();
  private known: Set<string>;
  blocked = false;
  unconfirmed: string[] = [];

  constructor(knownUrls: Iterable<string>) {
    this.known = new Set([...knownUrls].map(norm));
  }

  confirm(url: string) {
    this.known.add(norm(url));
  }

  push(text: string): { delta: string; citations: { url: string; label: string }[] } {
    this.raw += text;
    return this.advance(false);
  }

  finish(): { delta: string; citations: { url: string; label: string }[] } {
    return this.advance(true);
  }

  get text(): string {
    return this.shown;
  }

  private advance(final: boolean) {
    const none = { delta: "", citations: [] };
    if (this.blocked) return none;
    if (BLOCKERS.some((b) => this.raw.includes(b))) {
      this.blocked = true;
      return none;
    }
    const cut = Math.max(this.committed, final ? this.raw.length : this.safeEnd());
    let segment = this.raw.slice(this.committed, cut);
    if (!final) segment = segment.replace(/\s+$/, "");
    if (!segment && !final) return none;
    let out = this.clean(segment);
    if (!this.shown) out = out.trimStart();
    if (final) out = out.trimEnd();
    const tail = this.shown.slice(-16) + out;
    if (BLOCKERS.some((b) => tail.includes(b))) {
      this.blocked = true;
      return none;
    }
    this.committed += segment.length;
    this.shown += out;
    const citations: { url: string; label: string }[] = [];
    for (const m of out.matchAll(LINK)) {
      if (!this.cited.has(m[2])) {
        this.cited.add(m[2]);
        citations.push({ url: m[2], label: m[1] });
      }
    }
    return { delta: out, citations };
  }

  private safeEnd(): number {
    const raw = this.raw;
    let cut = raw.length;
    const open = raw.lastIndexOf("【");
    if (open >= this.committed && raw.indexOf("】", open) < 0) cut = Math.min(cut, open);
    for (let i = raw.indexOf("[", this.committed); i >= 0 && i < cut; i = raw.indexOf("[", i + 1)) {
      if (couldBeLink(raw.slice(i))) {
        cut = Math.min(cut, i);
        break;
      }
    }
    for (const b of BLOCKERS) {
      for (let k = Math.min(b.length - 1, raw.length); k > 0; k--) {
        if (b.startsWith(raw.slice(-k))) {
          cut = Math.min(cut, raw.length - k);
          break;
        }
      }
    }
    return cut;
  }

  private clean(text: string): string {
    let s = text.replace(/\s*【[^】]*】/g, "");
    s = s.replace(LINK, (whole, label: string, url: string) => {
      if (this.known.has(norm(url))) return whole;
      if (!this.unconfirmed.includes(url)) this.unconfirmed.push(url);
      return label.replace(/[[\]]/g, "");
    });
    return s.replace(/[ \t]+$/gm, "");
  }
}
