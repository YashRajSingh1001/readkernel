// POST /api/ask: one turn of the Ask ReadKernel chat (see lib/server/agent.ts).

import { isSharedQuestion } from "@/lib/ask";
import { getLatestEdition } from "@/lib/brief";
import { AgentUnavailable, askAgent, type ChatTurn } from "@/lib/server/agent";
import { askCacheKey, readCachedAnswer, saveCachedAnswer } from "@/lib/server/ask-cache";

const MAX_TURNS = 6; // the last few messages give follow-up questions their context
const MAX_CHARS = 600;

// Best-effort limit per visitor, to keep within Groq's free quota. It lives in
// one server instance's memory, which is enough to stop casual abuse.
const WINDOW_MS = 10 * 60 * 1000;
const PER_WINDOW = 12;
const recent = new Map<string, number[]>();

function allowed(ip: string): boolean {
  const now = Date.now();
  const times = (recent.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (times.length >= PER_WINDOW) return false;
  times.push(now);
  recent.set(ip, times);
  if (recent.size > 5000) recent.clear();
  return true;
}

function parse(body: unknown): ChatTurn[] | null {
  const list = (body as { messages?: unknown })?.messages;
  if (!Array.isArray(list) || list.length === 0) return null;
  const turns = list.slice(-MAX_TURNS).map((m) => ({
    role: (m as ChatTurn)?.role,
    content: String((m as ChatTurn)?.content ?? "").trim().slice(0, MAX_CHARS),
  }));
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
    // Set when Ask was opened from a story page; an unknown key is ignored.
    if (typeof body?.story === "string" && STORY_KEY_RE.test(body.story)) storyKey = body.story;
  } catch {
    // fall through
  }
  if (!turns) return Response.json({ error: "Send a question." }, { status: 400 });

  // A suggested first question: today's answer may already be stored. Checked
  // before the rate limit, because a stored answer costs no AI.
  let cacheKey: string | null = null;
  if (turns.length === 1 && isSharedQuestion(turns[0].content, storyKey)) {
    const edition = await getLatestEdition();
    if (edition) {
      cacheKey = askCacheKey(edition.date, turns[0].content, storyKey);
      const hit = await readCachedAnswer(cacheKey);
      if (hit) return Response.json({ ...hit, complete: true });
    }
  }

  const ip = (request.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  if (!allowed(ip)) {
    return Response.json({ error: "You've asked a lot in a short time. Please wait a few minutes." }, { status: 429 });
  }

  try {
    const result = await askAgent(turns, { storyKey });
    if (cacheKey && result.complete) await saveCachedAnswer(cacheKey, { answer: result.answer, steps: result.steps });
    return Response.json(result);
  } catch (err) {
    console.error("[ask]", err);
    const message =
      err instanceof AgentUnavailable
        ? "Ask ReadKernel is resting right now. Please try again in a minute."
        : "Something went wrong while answering. Please try again.";
    return Response.json({ error: message }, { status: 503 });
  }
}
