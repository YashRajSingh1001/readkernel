// POST /api/ask: one turn of the Ask ReadKernel chat (see lib/server/agent.ts).

import { AgentUnavailable, askAgent, type ChatTurn } from "@/lib/server/agent";

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

export async function POST(request: Request) {
  const ip = (request.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  if (!allowed(ip)) {
    return Response.json({ error: "You've asked a lot in a short time. Please wait a few minutes." }, { status: 429 });
  }
  let turns: ChatTurn[] | null = null;
  let storyKey: string | undefined;
  try {
    const body = await request.json();
    turns = parse(body);
    // Set when Ask was opened from a story page; an unknown key is ignored.
    if (typeof body?.story === "string" && body.story) storyKey = body.story.slice(0, 40);
  } catch {
    // fall through
  }
  if (!turns) return Response.json({ error: "Send a question." }, { status: 400 });

  try {
    return Response.json(await askAgent(turns, { storyKey }));
  } catch (err) {
    console.error("[ask]", err);
    const message =
      err instanceof AgentUnavailable
        ? "Ask ReadKernel is resting right now. Please try again in a minute."
        : "Something went wrong while answering. Please try again.";
    return Response.json({ error: message }, { status: 503 });
  }
}
