import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { register } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { NDJSON } from "./ask-stream.ts";

register("./test-support/server-loader.mjs", import.meta.url);
const { POST: ask } = await import("../app/api/ask/route.ts");
const { POST: mcp } = await import("../app/mcp/route.ts");
const { searchCompanyPosts } = await import("./companies.ts");
const { askCacheKey } = await import("./server/ask-cache.ts");

const QUESTION = "How did Uber use AI to clean up its code?";
const QUERY = "uber ai code";
const PRIVATE_ERROR = "Supabase 500: company_posts private diagnostic";
const STORY = {
  edition_date: "2026-11-15", story_key: "uber-ai-code", headline: "Uber uses AI",
  summary: "Uber uses AI to clean up code.", topic: "ai", published: "2026-11-15",
  sources: [{ name: "Uber", url: "https://example.com/uber" }],
};
const POST = {
  url: "uber-ai", link: "https://example.com/blog", title: "Uber engineering",
  company: "Uber", published: "2026-11-15", summary: "AI code cleanup", category: "ai",
};

function sse(items: unknown[], text?: string) {
  const events: unknown[] = items.map((item) => ({ type: "response.output_item.done", item }));
  if (text) events.push(
    { type: "response.output_item.added", item: { id: "answer", type: "message" } },
    { type: "response.output_text.delta", item_id: "answer", delta: text },
  );
  events.push({ type: "response.completed", response: { status: "completed" } });
  return new Response(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""));
}

type Failure = "posts" | "stories" | "both" | null;

function fixture(t: TestContext, failed: Failure, options: { recover?: boolean; invalid?: boolean; long?: boolean } = {}) {
  const env = {
    READ_LOCAL_DATA: "0", SUPABASE_URL: "https://database.invalid", SUPABASE_PUBLISHABLE_KEY: "test-public",
    SUPABASE_SECRET_KEY: "test-admin", OPENAI_API_KEY: "test-ai", ASK_PROVIDER: "openai",
    ASK_CACHE: "on", ASK_WEB_SEARCH: "off", AI_USAGE_LOG: "off",
  };
  for (const [key, value] of Object.entries(env)) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
  t.mock.method(console, "error", () => {});
  t.mock.method(console, "info", () => {});
  const state = { stories: 0, posts: 0, writes: 0, rounds: 0, toolOutputs: [] as string[], keys: [] as string[] };
  const cache = new Map<string, unknown>([
    [`2026-11-15|-|${QUESTION}`, { answer: "Legacy failure answer", steps: [] }],
  ]);
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const table = url.pathname.split("/").at(-1);
    if (url.hostname === "database.invalid") {
      if (table === "editions") return Response.json([{ date: "2026-11-15", stories: [], discussions: [] }]);
      if (table === "ask_answers") {
        if (init?.method === "POST") {
          const row = JSON.parse(String(init.body));
          state.writes++;
          cache.set(row.key, { answer: row.answer, steps: row.steps });
          return new Response(null, { status: 204 });
        }
        const key = url.searchParams.get("key")!.slice(3);
        state.keys.push(key);
        return Response.json(cache.has(key) ? [cache.get(key)] : []);
      }
      if (table === "stories" || table === "company_posts") {
        const side = table === "stories" ? "stories" : "posts";
        state[side]++;
        if ((failed === side || failed === "both") && (!options.recover || state[side] === 1)) {
          return new Response(PRIVATE_ERROR, { status: 500 });
        }
        return Response.json(side === "stories" ? [{ ...STORY, ...(options.long ? { summary: "x".repeat(20_000) } : {}) }] : [POST]);
      }
    }
    if (url.pathname.endsWith("/responses")) {
      state.rounds++;
      const body = JSON.parse(String(init?.body));
      for (const item of body.input) {
        if (item.type === "function_call_output") state.toolOutputs.push(item.output);
      }
      if (state.rounds === 1 || ((options.recover || options.invalid) && state.rounds === 2)) {
        return sse([{ type: "function_call", call_id: `search-${state.rounds}`, name: "search_news",
          arguments: JSON.stringify({ query: options.invalid && state.rounds === 1 ? "x" : QUERY }) }]);
      }
      return sse([], "Here is what I could check.");
    }
    throw new Error(`Unexpected request: ${url}`);
  });
  return state;
}

async function requestAsk(streaming: boolean, story?: string) {
  const response = await ask(new Request("https://readkernel.invalid/api/ask", {
    method: "POST", headers: { accept: streaming ? NDJSON : "application/json", "x-forwarded-for": crypto.randomUUID() },
    body: JSON.stringify({ messages: [{ role: "user", content: story ? "Who are the competitors here?" : QUESTION }], story }),
  }));
  assert.equal(response.status, 200);
  const text = await response.text();
  assert.doesNotMatch(text, /Supabase|500|private diagnostic|company_posts/);
  assert.doesNotMatch(text, /"degraded"/);
  assert.doesNotMatch(text, /Legacy failure answer/);
  const result = streaming ? JSON.parse(text.trim().split("\n").at(-1)!) : JSON.parse(text);
  assert.equal(result.complete, true);
  return result;
}

for (const streaming of [false, true]) {
  for (const failed of ["posts", "stories", "both"] as const) {
    test(`${streaming ? "streaming" : "JSON"} Ask never caches a shared answer after ${failed} fail`, async (t) => {
      const state = fixture(t, failed, { long: true });
      const result = await requestAsk(streaming);
      assert.equal(state.writes, 0);
      assert.equal(state.stories, 1);
      assert.equal(state.posts, 1);
      assert.ok(state.toolOutputs.length > 0);
      assert.doesNotMatch(state.toolOutputs.join(""), /Supabase|500|private diagnostic|company_posts/);
      if (failed === "both") assert.equal(result.steps[0].ok, false);
      else {
        assert.equal(result.steps[0].counts.unavailable, true);
        assert.match(state.toolOutputs[0], /"unavailable":true/);
      }
    });
  }

  test(`${streaming ? "streaming" : "JSON"} Ask stays degraded after a successful retry`, async (t) => {
    const state = fixture(t, "posts", { recover: true });
    const result = await requestAsk(streaming);
    assert.equal(state.posts, 2);
    assert.equal(result.steps[1].counts.unavailable, undefined);
    assert.equal(state.writes, 0);
  });

  test(`${streaming ? "streaming" : "JSON"} Ask does not cache a story suggestion after its preload fails`, async (t) => {
    const state = fixture(t, "stories", { recover: true });
    const result = await requestAsk(streaming, "uber-ai-code");
    assert.equal(result.steps[0].tool, "get_story");
    assert.equal(result.steps[0].ok, false);
    assert.equal(result.steps[1].ok, true);
    assert.equal(state.writes, 0);
  });

  test(`${streaming ? "streaming" : "JSON"} Ask caches healthy shared answers after corrected tool input`, async (t) => {
    const state = fixture(t, null, { invalid: true });
    await requestAsk(streaming);
    assert.equal(state.writes, 1);
    const rounds = state.rounds;
    assert.equal((await requestAsk(streaming)).cached, true);
    assert.equal(state.rounds, rounds);
    assert.ok(state.keys.every((key) => key === askCacheKey("2026-11-15", QUESTION)));
    assert.notEqual(state.keys[0], `2026-11-15|-|${QUESTION}`, "pre-fix answers must be bypassed");
  });
}

for (const failed of ["posts", "stories", "both"] as const) {
  test(`MCP preserves its envelope and sanitizes ${failed} lookup failures`, async (t) => {
    const state = fixture(t, failed);
    const response = await mcp(new Request("https://readkernel.invalid/mcp", {
      method: "POST", body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call",
        params: { name: "search_news", arguments: { query: QUERY } } }),
    }));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.jsonrpc, "2.0");
    assert.equal(body.id, 1);
    assert.equal(body.result.content[0].type, "text");
    assert.doesNotMatch(JSON.stringify(body), /Supabase|500|private diagnostic|company_posts/);
    if (failed === "both") assert.equal(body.result.isError, true);
    else {
      const result = JSON.parse(body.result.content[0].text);
      assert.deepEqual(result[failed === "posts" ? "company_blog_posts" : "stories"], { unavailable: true });
      assert.ok(Array.isArray(result[failed === "posts" ? "stories" : "company_blog_posts"]));
    }
    assert.equal(state.posts, 1);
    assert.equal(state.stories, 1);
  });
}

test("local company search rejects missing and malformed data, and retries after recovery", async (t) => {
  fixture(t, null);
  const dir = await mkdtemp(path.join(tmpdir(), "readkernel-posts-"));
  const previous = process.env.LOCAL_DATA_DIR;
  process.env.READ_LOCAL_DATA = "1";
  process.env.LOCAL_DATA_DIR = dir;
  t.after(async () => {
    if (previous === undefined) delete process.env.LOCAL_DATA_DIR; else process.env.LOCAL_DATA_DIR = previous;
    await rm(dir, { recursive: true, force: true });
  });
  await assert.rejects(searchCompanyPosts("uber"));
  await writeFile(path.join(dir, "company_posts.json"), "broken json");
  await assert.rejects(searchCompanyPosts("uber"));
  await writeFile(path.join(dir, "company_posts.json"), JSON.stringify([POST]));
  assert.deepEqual(await searchCompanyPosts("uber"), [POST]);
  assert.deepEqual(await searchCompanyPosts("missing"), []);
});
