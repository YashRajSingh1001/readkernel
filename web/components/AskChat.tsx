"use client";

// The Ask ReadKernel chat. Everything it shows while an answer is on its way
// comes from /api/ask's event stream (lib/ask-stream.ts): which tool is running
// and what it found, OpenAI retries, and the answer text as it's written. No
// status here is driven by a timer.

import Link from "next/link";
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { STORY_SUGGESTIONS, SUGGESTIONS } from "@/lib/ask";
import { NDJSON, readEvents, type AskEvent, type AskStep, type ToolCounts } from "@/lib/ask-stream";

export type FocusStory = { key: string; headline: string };

type Activity = AskStep & { id: string; state: "running" | "done" | "failed" };
// What the server is doing right now, when no tool is running and no text has arrived.
type Phase = { kind: "sending" } | { kind: "thinking"; round: number } | { kind: "retry"; waitSeconds: number; reason: string };
type Answer = {
  role: "assistant";
  id: number;
  question: string;
  content: string;
  steps: Activity[];
  phase: Phase | null;
  state: "working" | "done" | "stopped" | "error";
  cached?: string; // the edition date of a saved answer
  truncated?: boolean;
  error?: string;
  retryable?: boolean;
};
type Turn = { role: "user"; content: string } | Answer;

const IDLE_MS = 60_000; // no event from the server for this long: give up (the server gives up on OpenAI at 45s)
const NEAR_BOTTOM_PX = 120;

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function shortDate(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

/** "10 stories, 2 blog posts" from what a tool really returned. */
function found(c: ToolCounts | undefined, tool: string): string {
  if (!c) return "";
  if (c.empty) return "nothing found";
  if (tool === "get_story") return c.timeline ? plural(c.timeline, "earlier day") : "no earlier coverage";
  const parts: string[] = [];
  if (c.stories) parts.push(plural(c.stories, "story", "stories"));
  if (c.posts) parts.push(plural(c.posts, "blog post"));
  if (c.articles) parts.push(plural(c.articles, "article"));
  if (c.timeline) parts.push(plural(c.timeline, "earlier day"));
  if (c.pages) parts.push(plural(c.pages, "page"));
  return parts.join(", ") || "nothing found";
}

/** One tool call in words: what it's doing while it runs, what it did once finished. */
function describe(step: Activity): string {
  const a = step.args;
  const running = step.state === "running";
  const c = step.counts;
  let what: string;
  switch (step.tool) {
    case "search_news":
      what = `${running ? "Searching" : "Searched"} “${String(a.query ?? "")}”`;
      if (c?.matched_query) what += ` → “${c.matched_query}”`;
      break;
    case "get_today_news": {
      const which = a.scope === "feed" ? "full feed" : "brief";
      what = c?.date ? `Read the ${shortDate(c.date)} ${which}` : `${running ? "Reading" : "Read"} the latest ${which}`;
      break;
    }
    case "get_brief_by_date":
      what = `${running ? "Reading" : "Read"} the brief for ${String(a.date ?? "")}`;
      break;
    case "get_story":
      what = `${running ? "Reading" : "Read"} the story and its timeline`;
      break;
    case "get_company_news":
      what = `${running ? "Looking up" : "Looked up"} ${String(a.company ?? "company")} coverage`;
      break;
    case "get_top_articles":
      what = `${running ? "Checking" : "Checked"} Top articles`;
      break;
    case "web_search":
      if (running) what = "Searching the web";
      else if (a.url) what = `Opened ${String(a.url).replace(/^https?:\/\/(www\.)?/, "").split("/")[0]}`;
      else what = a.query ? `Searched the web for “${String(a.query)}”` : "Searched the web";
      break;
    case "get_company_posts":
      what = `${running ? "Checking" : "Checked"} ${a.company ? `${String(a.company)} blog posts` : "company blog posts"}`;
      break;
    default:
      what = step.tool;
  }
  if (running) return `${what}…`;
  if (step.state === "failed") return `${what}: failed${step.error ? ` (${step.error})` : ""}`;
  const result = found(c, step.tool);
  return result ? `${what} · ${result}` : what;
}

function phaseText(phase: Phase, steps: Activity[]): string {
  switch (phase.kind) {
    case "sending":
      return "Sending your question…";
    case "thinking":
      return phase.round === 1 && steps.length === 0 ? "Deciding where to look…" : "Reading what it found…";
    case "retry":
      return `OpenAI is ${phase.reason === "rate_limited" ? "rate-limiting us" : "having trouble"}; trying again in ${plural(phase.waitSeconds, "second")}…`;
  }
}

/** The finished questions and answers, sent back so follow-ups have context. Stopped and failed answers are left out. */
function conversation(turns: Turn[]): { role: "user" | "assistant"; content: string }[] {
  const out: { role: "user" | "assistant"; content: string }[] = [];
  for (let i = 0; i < turns.length - 1; i++) {
    const q = turns[i];
    const a = turns[i + 1];
    if (q.role === "user" && a.role === "assistant" && a.state === "done" && a.content) {
      out.push({ role: "user", content: q.content }, { role: "assistant", content: a.content });
    }
  }
  return out;
}

/** The links in an answer, once each: by now every one was confirmed by the server. */
function sourcesIn(text: string): { url: string; label: string; host: string }[] {
  const seen = new Map<string, { url: string; label: string; host: string }>();
  for (const m of text.matchAll(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g)) {
    if (seen.has(m[2])) continue;
    let host = m[2];
    try {
      host = new URL(m[2]).hostname.replace(/^www\./, "");
    } catch {
      // keep the URL
    }
    seen.set(m[2], { url: m[2], label: m[1], host });
  }
  return [...seen.values()];
}

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// A tiny, safe markdown renderer: paragraphs, "-" bullets, **bold** and
// [text](https://links). Everything else stays plain text; no HTML is ever injected.
function inline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    if (match[2]) {
      parts.push(
        <a key={match.index} href={match[2]} target="_blank" rel="noopener noreferrer" className="rk-fade text-accent underline-offset-2 hover:underline">
          {match[1]}
        </a>,
      );
    } else {
      parts.push(<strong key={match.index}>{match[3]}</strong>);
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

const BULLET = /^\s*([-*•]|\d+\.)\s+/;

function Markdown({ text }: { text: string }) {
  // Blocks are split by blank lines; inside one, runs of bullet lines become a
  // list and other lines a paragraph ("Intro:\n- a\n- b" is common).
  const parts: { list: boolean; lines: string[] }[] = [];
  for (const block of text.split(/\n{2,}/)) {
    let current: { list: boolean; lines: string[] } | null = null;
    for (const line of block.split("\n").filter((l) => l.trim())) {
      const list = BULLET.test(line);
      if (!current || current.list !== list) parts.push((current = { list, lines: [] }));
      current.lines.push(line);
    }
  }
  return (
    <>
      {parts.map(({ list, lines }, i) => {
        if (list) {
          const numbered = /^\s*\d+\./.test(lines[0]);
          const List = numbered ? "ol" : "ul";
          return (
            <List key={i} className={`my-3 space-y-1.5 pl-6 ${numbered ? "list-decimal" : "list-disc"}`}>
              {lines.map((l, j) => (
                <li key={j} className="pl-1">
                  {inline(l.replace(BULLET, ""))}
                </li>
              ))}
            </List>
          );
        }
        return (
          <p key={i} className="my-3 first:mt-0">
            {lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {inline(l.replace(/^#+\s*/, ""))}
              </Fragment>
            ))}
          </p>
        );
      })}
    </>
  );
}

export function AskChat({ story }: { story?: FocusStory }) {
  const [focus, setFocus] = useState(story);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [announce, setAnnounce] = useState("");
  const [away, setAway] = useState(false); // the reader scrolled up from the newest text
  const active = useRef<{ id: number; controller: AbortController } | null>(null);
  const turnsRef = useRef(turns);
  const nextId = useRef(1);
  const follow = useRef(true);
  const autoY = useRef<number | null>(null); // where our last automatic scroll left the page
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const busy = turns.some((t) => t.role === "assistant" && t.state === "working");

  useEffect(() => {
    turnsRef.current = turns;
  }, [turns]);

  // Leaving the page stops the answer, and with it the work on the server.
  useEffect(() => () => active.current?.controller.abort(), []);

  // Follow new text only while the reader is at (or near) the bottom.
  useEffect(() => {
    // "Bottom" is the end of the chat, not of the page (the site footer is below it).
    const onScroll = () => {
      const end = endRef.current;
      if (!end) return;
      const near = end.getBoundingClientRect().top <= window.innerHeight + NEAR_BOTTOM_PX;
      follow.current = near;
      setAway(!near);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useLayoutEffect(() => {
    if (!busy || !follow.current) return;
    // The reader scrolled up since our last move, and its scroll event hasn't arrived yet.
    if (autoY.current !== null && window.scrollY < autoY.current - 4) {
      follow.current = false;
      setAway(true);
      return;
    }
    endRef.current?.scrollIntoView({ block: "end", behavior: "instant" });
    autoY.current = window.scrollY;
  }, [turns, busy]);

  function jumpToLatest() {
    follow.current = true;
    autoY.current = null;
    endRef.current?.scrollIntoView({ block: "end", behavior: reducedMotion() ? "instant" : "smooth" });
  }

  function update(id: number, change: (a: Answer) => Partial<Answer>) {
    setTurns((all) => all.map((t) => (t.role === "assistant" && t.id === id ? { ...t, ...change(t) } : t)));
  }

  function stop() {
    const current = active.current;
    if (!current) return;
    active.current = null;
    current.controller.abort();
    update(current.id, (a) => (a.state === "working" ? { state: "stopped", phase: null } : {}));
    setAnnounce("Stopped.");
  }

  function apply(id: number, e: AskEvent) {
    switch (e.type) {
      case "status":
        if (e.phase === "cached") update(id, () => ({ cached: e.date, phase: null }));
        else if (e.phase === "thinking") update(id, () => ({ phase: { kind: "thinking", round: e.round } }));
        else update(id, () => ({ phase: { kind: "retry", waitSeconds: e.waitSeconds, reason: e.reason } }));
        break;
      case "tool":
        if (e.state === "started") {
          update(id, (a) => ({ phase: null, steps: [...a.steps, { id: e.id, tool: e.tool, args: e.args, state: "running" }] }));
        } else {
          update(id, (a) => ({
            steps: a.steps.map((s) =>
              s.id === e.id
                ? { ...s, args: e.args ?? s.args, state: e.ok ? "done" : "failed", ok: e.ok, counts: e.counts, error: e.error }
                : s,
            ),
          }));
        }
        break;
      case "delta":
        update(id, (a) => ({ phase: null, content: a.content + e.text }));
        break;
      case "discard":
        update(id, () => ({ content: "" }));
        break;
      case "citation":
        // The link arrives in the next delta; nothing to do until then.
        break;
      case "done":
        update(id, (a) => ({
          state: "done",
          phase: null,
          content: e.answer,
          truncated: e.truncated,
          // A saved answer's steps were recorded on an earlier run; a live one's are already here.
          steps: e.cached ? e.steps.map((s, i) => ({ ...s, id: `saved-${i}`, state: s.ok === false ? "failed" : "done" })) : a.steps,
        }));
        setAnnounce(e.truncated ? "Answer ready, but it was cut off." : "Answer ready.");
        break;
      case "error":
        update(id, () => ({ state: "error", phase: null, error: e.message, retryable: e.retryable }));
        setAnnounce(e.message);
        break;
    }
  }

  async function ask(question: string, replacing?: number) {
    const q = question.trim();
    if (!q) return;
    // A new question replaces one still being answered.
    if (active.current) stop();

    const id = nextId.current++;
    const controller = new AbortController();
    active.current = { id, controller };
    // Asking again leaves out the answer being replaced, so the model doesn't see its own first try.
    const earlier = turnsRef.current.filter(
      (t, i, all) =>
        replacing === undefined ||
        !((t.role === "assistant" && t.id === replacing) || (all[i + 1]?.role === "assistant" && (all[i + 1] as Answer).id === replacing)),
    );
    const history = [...conversation(earlier), { role: "user" as const, content: q }];
    setTurns((all) => {
      // Asking again after a failure: the failed attempt makes way for the new one.
      const at = replacing === undefined ? -1 : all.findIndex((t) => t.role === "assistant" && t.id === replacing);
      const kept = at > 0 ? [...all.slice(0, at - 1), ...all.slice(at + 1)] : all;
      return [
        ...kept,
        { role: "user", content: q },
        { role: "assistant", id, question: q, content: "", steps: [], phase: { kind: "sending" }, state: "working" },
      ];
    });
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    setAnnounce("Looking into it.");
    follow.current = true;
    autoY.current = null;
    requestAnimationFrame(() => endRef.current?.scrollIntoView({ block: "end", behavior: "instant" }));

    // Give up if the server goes quiet; every event resets the clock.
    let idle = setTimeout(() => controller.abort("timeout"), IDLE_MS);
    const alive = () => {
      clearTimeout(idle);
      idle = setTimeout(() => controller.abort("timeout"), IDLE_MS);
    };
    const fail = (message: string, retryable = true) => {
      update(id, () => ({ state: "error", phase: null, error: message, retryable }));
      setAnnounce(message);
    };

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: NDJSON },
        body: JSON.stringify({ messages: history, story: focus?.key }),
        signal: controller.signal,
      });
      // Bad request or rate limit: a plain JSON error, sent before any work started.
      if (!res.body || !(res.headers.get("content-type") ?? "").includes(NDJSON)) {
        const data = await res.json().catch(() => ({}));
        fail(data.error ?? "Something went wrong.", res.status !== 400);
        return;
      }
      let ended = false;
      for await (const e of readEvents(res.body)) {
        if (active.current?.id !== id) break; // replaced or stopped
        alive();
        apply(id, e);
        if (e.type === "done" || e.type === "error") ended = true;
      }
      if (!ended && active.current?.id === id) fail("The answer was cut off before it finished.");
    } catch {
      if (controller.signal.aborted && controller.signal.reason !== "timeout") return; // stopped by the reader
      fail(
        controller.signal.reason === "timeout"
          ? "ReadKernel stopped responding. Please try again."
          : "Couldn't reach ReadKernel. Check your connection.",
      );
    } finally {
      clearTimeout(idle);
      if (active.current?.id === id) active.current = null;
    }
  }

  return (
    <div>
      {focus && (
        <div className="mb-6 flex items-start gap-3 rounded-md border border-accent/40 bg-accent-soft px-4 py-3 text-sm">
          <p className="min-w-0 flex-1">
            <span className="text-xs font-semibold text-muted">Asking about</span>
            <Link href={`/story/${focus.key}`} className="mt-0.5 block font-semibold hover:text-accent">
              {focus.headline}
            </Link>
          </p>
          <button
            type="button"
            onClick={() => setFocus(undefined)}
            disabled={busy}
            className="shrink-0 text-muted hover:text-ink disabled:opacity-40"
            aria-label="Stop asking about this story"
          >
            ✕
          </button>
        </div>
      )}

      {turns.length === 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {(focus ? STORY_SUGGESTIONS : SUGGESTIONS).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => ask(s)}
              className="rounded-md border border-line bg-card px-4 py-3 text-left text-sm hover:border-ink"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Announced to screen readers: the start and end of each answer, not every word. */}
      <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announce}
      </p>

      <div className="space-y-8">
        {turns.map((t, i) =>
          t.role === "user" ? (
            <div key={`q${i}`} className="flex justify-end">
              <p className="max-w-[85%] rounded-lg bg-sunk px-4 py-2.5 whitespace-pre-wrap [overflow-wrap:anywhere]">{t.content}</p>
            </div>
          ) : (
            <AnswerView
              key={`a${t.id}`}
              answer={t}
              // Re-asking a finished answer only makes sense for the latest one; later turns built on it.
              last={i === turns.length - 1}
              onRetry={() => ask(t.question, t.id)}
            />
          ),
        )}
        {/* scroll-mb keeps the newest line clear of the sticky question box */}
        <div ref={endRef} className="scroll-mb-32" />
      </div>

      {/* The question box stays at the bottom of the screen on a solid bar, so answers scroll behind it cleanly. */}
      <div className="sticky bottom-0 mt-8 bg-paper pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {busy && away && (
          <button
            type="button"
            onClick={jumpToLatest}
            className="rk-fade absolute -top-9 left-1/2 -translate-x-1/2 rounded-full border border-line bg-card px-3 py-1.5 text-xs text-muted shadow-sm hover:text-ink"
          >
            ↓ Jump to latest
          </button>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
          className="flex items-end gap-2 rounded-lg border border-line bg-card p-2 shadow-sm focus-within:border-ink"
        >
          <label htmlFor="ask-input" className="sr-only">
            Your question
          </label>
          <textarea
            ref={inputRef}
            id="ask-input"
            rows={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              // Grow with the text, up to about eight lines.
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
            }}
            onKeyDown={(e) => {
              // Enter asks, Shift+Enter starts a new line.
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                ask(input);
              }
            }}
            maxLength={600}
            placeholder={turns.length ? "Ask a follow-up…" : focus ? "Ask about this story…" : "Ask about any tech or AI news…"}
            className="max-h-[200px] min-w-0 flex-1 resize-none bg-transparent px-3 py-2 leading-6 outline-none"
          />
          {busy && !input.trim() ? (
            <button
              type="button"
              onClick={stop}
              aria-label="Stop answering"
              className="grid size-10 shrink-0 place-items-center rounded-md bg-ink text-paper hover:opacity-90"
            >
              <span className="size-3 rounded-[2px] bg-paper" aria-hidden />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              aria-label="Ask"
              className="grid size-10 shrink-0 place-items-center rounded-md bg-ink text-paper hover:opacity-90 disabled:opacity-30"
            >
              <svg viewBox="0 0 20 20" className="size-5" aria-hidden>
                <path d="M10 15V5m0 0-4.5 4.5M10 5l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </form>
        <p className="mt-1.5 text-center text-[11px] text-muted">
          Every answer links its sources. AI can make mistakes, so check them.
        </p>
      </div>
    </div>
  );
}

/** "3 ReadKernel lookups · 1 web search": what an answer's steps did, in one line. */
function summarize(steps: Activity[]): string {
  const web = steps.filter((s) => s.tool === "web_search").length;
  const own = steps.length - web;
  return [own ? plural(own, "ReadKernel lookup") : "", web ? plural(web, "web search", "web searches") : ""].filter(Boolean).join(" · ");
}

function AnswerView({ answer: a, last, onRetry }: { answer: Answer; last: boolean; onRetry: () => void }) {
  const working = a.state === "working";
  const failed = a.state === "error";
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [allSources, setAllSources] = useState(false);
  const sources = sourcesIn(a.content);
  const shownSources = allSources ? sources : sources.slice(0, 5);
  // While Ask works, its steps show as they happen; afterwards they fold into one line.
  const showSteps = working || open;

  return (
    <div className="[overflow-wrap:anywhere]">
      {a.cached && (
        <p className="rk-fade mb-2 text-xs text-label">
          Saved answer: this suggested question was answered earlier for the {shortDate(a.cached)} edition.
        </p>
      )}
      {a.steps.length > 0 && (
        <div className="mb-3 text-[13px] text-muted">
          {!working && (
            <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex items-center gap-1.5 hover:text-ink">
              <span>{summarize(a.steps)}</span>
              <span aria-hidden className="text-[10px]">
                {open ? "▾" : "▸"}
              </span>
            </button>
          )}
          {showSteps && (
            <ul
              className={`space-y-1 ${working ? "" : "mt-2 border-l border-line pl-3"}`}
              aria-label={a.cached ? "What Ask looked up on the saved run" : "What Ask looked up"}
            >
              {a.steps.map((s) => (
                <li key={s.id} className={`rk-fade ${s.state === "failed" ? "text-accent" : ""}`}>
                  {s.state === "running" ? "" : s.state === "failed" ? "✗ " : "✓ "}
                  {describe(s)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {a.phase && working && (
        <p key={JSON.stringify(a.phase)} className="rk-fade text-[13px] text-muted">
          {phaseText(a.phase, a.steps)}
        </p>
      )}
      {a.content && (
        <div className="text-[17px] leading-7">
          <Markdown text={a.content} />
        </div>
      )}

      {sources.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-xs font-semibold text-muted">Sources</p>
          <ul className="flex flex-wrap gap-1.5">
            {shownSources.map((x) => (
              <li key={x.url} className="rk-fade">
                <a
                  href={x.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={x.url}
                  className="inline-flex max-w-[16rem] items-baseline gap-1.5 rounded-md border border-line bg-card px-2.5 py-1 text-xs hover:border-ink"
                >
                  <span className="truncate font-semibold">{x.label}</span>
                  <span className="truncate text-muted">{x.host}</span>
                </a>
              </li>
            ))}
            {sources.length > 5 && (
              <li>
                <button
                  type="button"
                  onClick={() => setAllSources(!allSources)}
                  aria-expanded={allSources}
                  className="rounded-md px-2.5 py-1 text-xs text-muted hover:text-ink"
                >
                  {allSources ? "Show fewer" : `+${sources.length - 5} more`}
                </button>
              </li>
            )}
          </ul>
        </div>
      )}

      {a.truncated && <p className="mt-3 text-[13px] text-muted">This answer was cut off: it ran too long.</p>}
      {a.state === "stopped" && (
        <p className="mt-3 flex items-center gap-3 text-[13px] text-muted">
          Stopped{a.content ? " before the answer was finished" : ""}.
          <button type="button" onClick={onRetry} className="font-semibold text-accent hover:underline">
            Ask again
          </button>
        </p>
      )}
      {failed && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-md border border-accent/40 bg-accent-soft px-3 py-2 text-sm">
          <p>
            {a.error}
            {a.content ? " What's above is unfinished." : ""}
          </p>
          {a.retryable && (
            <button type="button" onClick={onRetry} className="font-semibold text-accent hover:underline">
              Try again
            </button>
          )}
        </div>
      )}
      {a.state === "done" && a.content && (
        <div className="mt-3 flex gap-3 text-xs text-muted">
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(a.content);
                setCopied(true);
              } catch {
                // clipboard blocked; nothing to show
              }
            }}
            onBlur={() => setCopied(false)}
            className="hover:text-ink"
          >
            {copied ? "Copied" : "Copy"}
          </button>
          {last && (
            <button type="button" onClick={onRetry} className="hover:text-ink">
              Ask again
            </button>
          )}
        </div>
      )}
    </div>
  );
}
