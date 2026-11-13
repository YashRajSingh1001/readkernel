// The Ask ReadKernel stream: what /api/ask sends, line by line, when the chat
// asks for application/x-ndjson. Every event reports something the server
// actually did; nothing here is timed or simulated.
//
// This file has no imports so the browser, the server and `node --test` can
// all load it.

/** Counts taken from a tool's real result. */
export type ToolCounts = {
  stories?: number;
  posts?: number;
  articles?: number;
  timeline?: number;
  /** The edition a "today" or dated brief actually came from. */
  date?: string;
  /** search_news found nothing for every word and broadened to this query. */
  matched_query?: string;
  /** The tool answered but found nothing, e.g. "No story with key …". */
  empty?: boolean;
  /** web_search: how many pages the search returned. */
  pages?: number;
};

/** One tool call, as the chat lists it. Older saved answers only have tool and args. */
export type AskStep = {
  tool: string;
  args: Record<string, unknown>;
  ok?: boolean;
  counts?: ToolCounts;
  error?: string;
};

export type AskEvent =
  /** thinking: a model request is in flight. retry: OpenAI said busy, waiting this long. */
  | { type: "status"; phase: "thinking"; round: number }
  | { type: "status"; phase: "retry"; waitSeconds: number; reason: "rate_limited" | "server_error" }
  /** A saved answer to a suggested question is being sent instead of a new AI run. */
  | { type: "status"; phase: "cached"; date: string }
  | { type: "tool"; id: string; state: "started"; tool: string; args: Record<string, unknown> }
  /** args: set when they're only known once the call is done (web searches). */
  | { type: "tool"; id: string; state: "finished"; ok: boolean; args?: Record<string, unknown>; counts?: ToolCounts; error?: string }
  /** Answer text, appended as generated. All deltas joined equal done.answer unless replaced. */
  | { type: "delta"; text: string }
  /** Text streamed so far turned out not to be the answer (the model went on to call tools). */
  | { type: "discard" }
  /** A link in the answer whose URL came from a tool result this run. Sent before the delta that holds it. */
  | { type: "citation"; url: string; label: string }
  | { type: "done"; answer: string; steps: AskStep[]; complete: boolean; cached: boolean; truncated: boolean }
  | { type: "error"; message: string; retryable: boolean; partial: boolean };

export const NDJSON = "application/x-ndjson";

/** Reads NDJSON events from a response body, however the bytes are split. */
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

/** What a tool result contained, counted from the result itself. */
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
  const found = (counts.stories ?? 0) + (counts.posts ?? 0) + (counts.articles ?? 0);
  if (r.story) counts.stories = 1;
  else if (found === 0 && (typeof r.message === "string" || counts.stories !== undefined || counts.posts !== undefined)) {
    counts.empty = true;
  }
  return counts;
}

/** Every http(s) URL in a piece of text (for tool results, the JSON the model was given). */
export function urlsIn(text: string): string[] {
  return text.match(/https?:\/\/[^\s"'<>\\)\]]+/g) ?? [];
}

const norm = (url: string) => url.replace(/[/.,;:]+$/, "");

// Markers that must never reach the reader: the model's off-topic signal and
// code fences (Ask doesn't hand out code). See lib/server/ask-scope.ts.
export const OFF_TOPIC_MARKER = "OFF_TOPIC";
const BLOCKERS = [OFF_TOPIC_MARKER, "```"];
const LINK = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g;

/** True while `s` (starting at "[") could still become [label](https://…). */
function couldBeLink(s: string): boolean {
  const m = /^\[([^\]\n]*)(\])?(\()?([^\s)]*)$/.exec(s);
  if (!m) return false;
  if (!m[2]) return m[1].length < 300;
  if (!m[3]) return s.length === m[1].length + 2;
  const url = m[4];
  return "https://".startsWith(url) || "http://".startsWith(url) || (/^https?:\/\//.test(url) && url.length < 2000);
}

/**
 * Turns the model's raw text into what the reader sees, as it streams:
 * - holds back anything that could still turn into a blocker, a 【…】 citation
 *   marker (the model's own citation style; dropped) or a markdown link, until it's settled;
 * - keeps a link only if its URL came from this run's tool results (else just
 *   its label), and reports each kept link as a citation before showing it;
 * - trims trailing spaces the same way the final answer is trimmed.
 * Joined, the deltas from push() and finish() are exactly the final text.
 */
export class AnswerGuard {
  private raw = "";
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

  /** Add model text; returns what can be shown now. */
  push(text: string): { delta: string; citations: { url: string; label: string }[] } {
    this.raw += text;
    return this.advance(false);
  }

  /** The model has finished: release everything that's left. */
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
    const next = this.render(final);
    // Rendering only ever extends what was shown; anything else is a bug in the hold-back rules.
    if (!next.startsWith(this.shown)) throw new Error("AnswerGuard: shown text changed");
    const delta = next.slice(this.shown.length);
    const citations: { url: string; label: string }[] = [];
    for (const m of delta.matchAll(LINK)) {
      if (!this.cited.has(m[2])) {
        this.cited.add(m[2]);
        citations.push({ url: m[2], label: m[1] });
      }
    }
    // A link can straddle the old and new text only if it was held back, so it can't; but be safe.
    this.shown = next;
    return { delta, citations };
  }

  private render(final: boolean): string {
    let cut = this.raw.length;
    if (!final) {
      const raw = this.raw;
      // An unclosed 【 …
      const open = raw.lastIndexOf("【");
      if (open >= 0 && raw.indexOf("】", open) < 0) cut = Math.min(cut, open);
      // … a "[" that may still become a link …
      for (let i = raw.indexOf("[", Math.max(0, raw.length - 2400)); i >= 0 && i < cut; i = raw.indexOf("[", i + 1)) {
        if (couldBeLink(raw.slice(i))) {
          cut = Math.min(cut, i);
          break;
        }
      }
      // … or the start of a blocker at the very end.
      for (const b of BLOCKERS) {
        for (let k = Math.min(b.length - 1, raw.length); k > 0; k--) {
          if (b.startsWith(raw.slice(-k))) {
            cut = Math.min(cut, raw.length - k);
            break;
          }
        }
      }
    }
    let s = this.raw.slice(0, cut);
    s = s.replace(/\s*【[^】]*】/g, "");
    s = s.replace(LINK, (whole, label: string, url: string) => {
      if (this.known.has(norm(url))) return whole;
      if (!this.unconfirmed.includes(url)) this.unconfirmed.push(url);
      return label;
    });
    s = s.replace(/[ \t]+$/gm, "").trimStart();
    // Trailing whitespace waits for the text after it (or is trimmed at the end).
    return s.trimEnd();
  }
}
