"use client";

import Link from "next/link";
import { Fragment, useRef, useState, type ReactNode } from "react";

import { STORY_SUGGESTIONS, SUGGESTIONS } from "@/lib/ask";

type Step = { tool: string; args: Record<string, unknown> };
type Turn = { role: "user" | "assistant"; content: string; steps?: Step[]; error?: boolean };

export type FocusStory = { key: string; headline: string };

// What each tool call looked like, in words.
function describe(step: Step): string {
  const a = step.args;
  switch (step.tool) {
    case "search_news":
      return `Searched “${String(a.query ?? "")}”`;
    case "get_today_news":
      return a.scope === "feed" ? "Read today's full feed" : "Read today's brief";
    case "get_brief_by_date":
      return `Read the brief for ${String(a.date ?? "")}`;
    case "get_story":
      return "Read the story and its timeline";
    case "get_company_news":
      return `Checked ${String(a.company ?? "company")} news`;
    case "get_top_articles":
      return "Checked Top articles";
    case "get_company_posts":
      return a.company ? `Checked ${String(a.company)}'s blog` : "Checked company blogs";
    default:
      return step.tool;
  }
}

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
        <a key={match.index} href={match[2]} target="_blank" rel="noopener noreferrer" className="text-accent underline-offset-2 hover:underline">
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

function Markdown({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <>
      {blocks.map((block, i) => {
        const lines = block.split("\n").filter((l) => l.trim());
        if (lines.length > 0 && lines.every((l) => /^\s*([-*•]|\d+\.)\s+/.test(l))) {
          return (
            <ul key={i} className="my-2 list-disc space-y-1 pl-5">
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*([-*•]|\d+\.)\s+/, ""))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="my-2">
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
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    const history = [...turns.filter((t) => !t.error), { role: "user" as const, content: q }];
    setTurns([...turns, { role: "user", content: q }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.map(({ role, content }) => ({ role, content })), story: focus?.key }),
      });
      const data = await res.json();
      setTurns((t) => [
        ...t,
        res.ok
          ? { role: "assistant", content: data.answer, steps: data.steps }
          : { role: "assistant", content: data.error ?? "Something went wrong.", error: true },
      ]);
    } catch {
      setTurns((t) => [...t, { role: "assistant", content: "Couldn't reach ReadKernel. Check your connection.", error: true }]);
    } finally {
      setBusy(false);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 50);
    }
  }

  return (
    <div>
      {focus && (
        <div className="mb-4 flex items-start gap-3 rounded-md border border-accent/40 bg-accent-soft px-4 py-3 text-sm">
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

      <div className="space-y-6" aria-live="polite">
        {turns.map((t, i) =>
          t.role === "user" ? (
            <div key={i} className="flex justify-end">
              <p className="max-w-[85%] rounded-lg rounded-br-sm bg-ink px-4 py-2.5 text-paper">{t.content}</p>
            </div>
          ) : (
            <div key={i} className={`rounded-lg border p-4 sm:p-5 ${t.error ? "border-accent/40 bg-accent-soft" : "border-line bg-card"}`}>
              {t.steps && t.steps.length > 0 && (
                <p className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
                  {t.steps.map((s, j) => (
                    <span key={j}>✓ {describe(s)}</span>
                  ))}
                </p>
              )}
              <div className="leading-relaxed">
                <Markdown text={t.content} />
              </div>
            </div>
          ),
        )}
        {busy && (
          <div className="rounded-lg border border-line bg-card p-4 text-xs text-muted" role="status">
            Reading the news archive…
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="sticky bottom-4 mt-6 flex gap-2 rounded-lg border border-line bg-paper/95 p-2 backdrop-blur"
      >
        <label htmlFor="ask-input" className="sr-only">
          Your question
        </label>
        <input
          id="ask-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={600}
          placeholder={turns.length ? "Ask a follow-up…" : focus ? "Ask about this story…" : "Ask about any tech or AI news…"}
          className="min-w-0 flex-1 bg-transparent px-3 py-2 outline-none"
          disabled={busy}
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded-md bg-ink px-4 py-2 font-semibold text-paper hover:opacity-90 disabled:opacity-40"
        >
          Ask
        </button>
      </form>
    </div>
  );
}
