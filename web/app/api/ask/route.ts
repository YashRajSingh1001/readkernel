import { isSharedQuestion } from "@/lib/ask";
import { NDJSON, type AskEvent } from "@/lib/ask-stream";
import { getLatestEdition } from "@/lib/brief";
import { AgentTimeout, AgentUnavailable, askAgent, type AgentAnswer, type ChatTurn } from "@/lib/server/agent";
import { AskUsage, recordAskUsage, type AskOutcome } from "@/lib/server/ai-usage";
import { askCacheKey, readCachedAnswer, saveCachedAnswer } from "@/lib/server/ask-cache";
import { OFF_TOPIC_REPLY } from "@/lib/server/ask-scope";

const MAX_TURNS = 6;
const MAX_CHARS = 600;
const MAX_ANSWER_CHARS = 6000;

const WINDOW_MS = 10 * 60 * 1000;
const PER_WINDOW = 12;
const recent = new Map<string, number[]>();

function waitFor(ip: string): number | null {
  const now = Date.now();
  const times = (recent.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (times.length >= PER_WINDOW) return Math.ceil((times[0] + WINDOW_MS - now) / 1000);
  times.push(now);
  recent.set(ip, times);
  if (recent.size > 5000) recent.clear();
  return null;
}

function failure(err: unknown): { message: string; retryable: boolean } {
  if (err instanceof AgentUnavailable) return { message: "Ask ReadKernel is resting right now. Please try again in a minute.", retryable: true };
  if (err instanceof AgentTimeout) return { message: "That took too long to answer. Try again, or ask something narrower.", retryable: true };
  return { message: "Something went wrong while answering. Please try again.", retryable: true };
}

function outcomeOf(result: AgentAnswer): AskOutcome {
  if (result.complete) return "answered";
  if (result.truncated) return "truncated";
  return result.answer === OFF_TOPIC_REPLY ? "off_topic" : "no_answer";
}

const STREAM_HEADERS = {
  "Content-Type": `${NDJSON}; charset=utf-8`,
  "Cache-Control": "no-store, no-transform",
  "X-Accel-Buffering": "no",
  Vary: "Accept",
};

function eventStream(work: (send: (e: AskEvent) => void, signal: AbortSignal) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const stop = new AbortController();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (e: AskEvent) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
        } catch {
          open = false;
        }
      };
      try {
        await work(send, stop.signal);
      } finally {
        open = false;
        try {
          controller.close();
        } catch {
        }
      }
    },
    cancel() {
      stop.abort();
    },
  });
  return new Response(stream, { headers: STREAM_HEADERS });
}

function parse(body: unknown): ChatTurn[] | null {
  const list = (body as { messages?: unknown })?.messages;
  if (!Array.isArray(list) || list.length === 0) return null;
  const turns = list.slice(-MAX_TURNS).map((m) => {
    const role = (m as ChatTurn)?.role;
    const limit = role === "assistant" ? MAX_ANSWER_CHARS : MAX_CHARS;
    return { role, content: String((m as ChatTurn)?.content ?? "").trim().slice(0, limit) };
  });
  if (turns.some((t) => (t.role !== "user" && t.role !== "assistant") || !t.content)) return null;
  if (turns.at(-1)!.role !== "user") return null;
  return turns as ChatTurn[];
}

const STORY_KEY_RE = /^[a-z0-9-]{6,40}$/;

export async function POST(request: Request) {
  let turns: ChatTurn[] | null = null;
  let storyKey: string | undefined;
  try {
    const body = await request.json();
    turns = parse(body);
    if (typeof body?.story === "string" && STORY_KEY_RE.test(body.story)) storyKey = body.story;
  } catch {
  }
  if (!turns) return Response.json({ error: "Send a question." }, { status: 400 });
  const streaming = (request.headers.get("accept") ?? "").includes(NDJSON);
  const suggested = turns.length === 1 && isSharedQuestion(turns[0].content, storyKey);
  const usage = new AskUsage();
  const logUsage = (outcome: AskOutcome, result?: AgentAnswer) => {
    if (result) usage.steps = result.steps.length;
    return recordAskUsage(usage, outcome, { story: storyKey, suggested });
  };

  let cacheKey: string | null = null;
  if (suggested) {
    try {
      const edition = await getLatestEdition();
      if (edition) {
        cacheKey = askCacheKey(edition.date, turns[0].content, storyKey);
        const hit = await readCachedAnswer(cacheKey);
        if (hit) {
          if (!streaming) {
            await logUsage("cached");
            return Response.json({ ...hit, complete: true, cached: true });
          }
          const date = edition.date;
          return eventStream(async (send) => {
            send({ type: "status", phase: "cached", date });
            send({ type: "done", answer: hit.answer, steps: hit.steps ?? [], complete: true, cached: true, truncated: false });
            await logUsage("cached");
          });
        }
      }
    } catch (err) {
      console.warn("[ask] shared answer lookup failed", err);
    }
  }

  const ip = (request.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  const wait = waitFor(ip);
  if (wait !== null) {
    return Response.json(
      { error: "You've asked a lot in a short time. Please wait a few minutes." },
      { status: 429, headers: { "Retry-After": String(wait) } },
    );
  }

  const save = async (result: { answer: string; steps: unknown[]; complete: boolean }) => {
    if (cacheKey && result.complete) await saveCachedAnswer(cacheKey, { answer: result.answer, steps: result.steps as never });
  };

  if (!streaming) {
    try {
      const result = await askAgent(turns, { storyKey, signal: request.signal, usage });
      await save(result);
      await logUsage(outcomeOf(result), result);
      return Response.json(result);
    } catch (err) {
      console.error("[ask]", err);
      await logUsage(request.signal.aborted ? "stopped" : "failed");
      return Response.json({ error: failure(err).message }, { status: 503 });
    }
  }

  const question = turns;
  return eventStream(async (send, stopped) => {
    const signal = AbortSignal.any([request.signal, stopped]);
    let partial = false;
    try {
      const result = await askAgent(question, {
        storyKey,
        signal,
        usage,
        onEvent: (e) => {
          if (e.type === "delta") partial = true;
          if (e.type === "discard") partial = false;
          send(e);
        },
      });
      send({ type: "done", answer: result.answer, steps: result.steps, complete: result.complete, cached: false, truncated: result.truncated });
      await save(result);
      await logUsage(outcomeOf(result), result);
    } catch (err) {
      if (signal.aborted && !(err instanceof AgentTimeout)) {
        console.info("[ask] stopped: the reader left or asked something else");
        await logUsage("stopped");
        return;
      }
      console.error("[ask]", err);
      send({ type: "error", ...failure(err), partial });
      await logUsage("failed");
    }
  });
}
