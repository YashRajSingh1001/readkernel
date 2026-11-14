import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { type TestContext } from "node:test";
import ts from "typescript";

import * as stream from "./ask-stream.ts";
import * as packing from "./tool-packing.ts";
import type { ChatTurn } from "./server/agent.ts";
import type { runTool } from "./tools.ts";

function load(file: string, dependencies: Record<string, unknown>): Record<string, unknown> {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  new Function("require", "exports", code)((name: string) => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  }, exports);
  return exports;
}

function agent(tool: typeof runTool) {
  const scope = load("./server/ask-scope.ts", { "server-only": {}, "../ask-stream": stream });
  return load("./server/agent.ts", {
    "server-only": {}, "../ask-stream": stream, "../tool-packing": packing, "./ask-scope": scope,
    "../tools": {
      NEWS_TOOLS: ["get_story", "search_news"].map((name) => ({ name, description: name, inputSchema: { type: "object", properties: {} } })),
      runTool: tool,
    },
  }) as typeof import("./server/agent.ts");
}

type Provider = "openai" | "groq";
type Item = { type?: string; role?: string; call_id?: string; output?: string; content?: string; tool_call_id?: string; tool_calls?: { id: string }[] };
type Request = { input?: Item[]; messages?: Item[] };

function setup(t: TestContext, provider: Provider, respond: (provider: Provider, body: Request) => Response) {
  for (const [key, value] of Object.entries({ ASK_PROVIDER: provider, OPENAI_API_KEY: "test-openai", GROQ_API_KEY: "test-groq", ASK_WEB_SEARCH: "on" })) {
    const original = process.env[key];
    process.env[key] = value;
    t.after(() => { if (original === undefined) delete process.env[key]; else process.env[key] = original; });
  }
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) =>
    respond(url.includes("api.groq.com") ? "groq" : "openai", JSON.parse(String(init.body))));
}

function sse(events: unknown[]): Response {
  const text = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("");
  const bytes = new TextEncoder().encode(text);
  return new Response(new ReadableStream({ start(controller) {
    for (let i = 0; i < bytes.length; i += 37) controller.enqueue(bytes.slice(i, i + 37));
    controller.close();
  } }));
}

function reply(provider: Provider, { text = "", calls = [], web = [] }: { text?: string; calls?: string[]; web?: string[] } = {}) {
  if (provider === "groq") return sse([
    ...[...text].map((content) => ({ choices: [{ delta: { content } }] })),
    { choices: [{ delta: { tool_calls: calls.map((id, index) => ({ index, id, function: { name: "search_news", arguments: JSON.stringify({ query: id }) } })) }, finish_reason: calls.length ? "tool_calls" : "stop" }] },
  ]);
  return sse([
    ...web.map((url, i) => ({ type: "response.output_item.done", item: { type: "web_search_call", id: `web_${i}`, status: "completed", action: { type: "search", sources: [{ url }] } } })),
    { type: "response.output_item.added", item: { type: "message", id: "answer" } },
    ...[...text].map((delta) => ({ type: "response.output_text.delta", item_id: "answer", delta })),
    { type: "response.output_item.done", item: { type: "reasoning", id: "reason", encrypted_content: "test" } },
    ...calls.map((id) => ({ type: "response.output_item.done", item: { type: "function_call", id: `fc_${id}`, call_id: id, name: "search_news", arguments: JSON.stringify({ query: id }) } })),
    { type: "response.completed", response: { status: "completed" } },
  ]);
}

function story(id: string, summary = 500) {
  const url = `https://news.example/${id}`;
  return { headline: id, summary: "News café 日本 ".padEnd(summary, "x"), url, cite: `[${id}](${url})` };
}

function search(id: string) {
  return { stories: Array.from({ length: 20 }, (_, i) => story(`${id}_${i}`)), company_blog_posts: [story(`${id}_blog`)] };
}

function outputs(provider: Provider, body: Request): string[] {
  const items = provider === "openai" ? body.input! : body.messages!;
  const calls = provider === "openai"
    ? items.filter((m) => m.type === "function_call").map((m) => m.call_id)
    : items.flatMap((m) => (m.tool_calls ?? []).map((call) => call.id));
  const tools = items.filter((m) => provider === "openai" ? m.type === "function_call_output" : m.role === "tool");
  assert.deepEqual(tools.map((m) => m.call_id ?? m.tool_call_id), calls);
  return tools.map((m) => {
    assert.deepEqual(Object.keys(m).sort(), (provider === "openai" ? ["type", "call_id", "output"] : ["role", "tool_call_id", "content"]).sort());
    const content = (m.output ?? m.content)!;
    assert.ok(content.length <= (provider === "openai" ? 12_000 : 4_000));
    assert.doesNotThrow(() => JSON.parse(content));
    return content;
  });
}

function shown(events: stream.AskEvent[]): string {
  let text = "";
  for (const event of events) {
    if (event.type === "discard") text = "";
    if (event.type === "delta") text += event.text;
  }
  return text;
}

const question: ChatTurn[] = [{ role: "user", content: "What is new with Nvidia?" }];

for (const provider of ["openai", "groq"] as const) {
  test(`${provider}: chat history alone cannot authorize citations`, async (t) => {
    const old = "https://old.example/unverified";
    const user = "https://user.example/unverified";
    setup(t, provider, (p, body) => {
      assert.ok(JSON.stringify(body).includes(old));
      return reply(p, { text: `See [old](${old}) and [user](${user}).` });
    });
    const { askAgent } = agent(async () => { throw new Error("Unexpected tool call"); });
    const events: stream.AskEvent[] = [];
    const result = await askAgent([
      { role: "assistant", content: `Earlier [source](${old}).` },
      { role: "user", content: `Tell me more about Nvidia and ${user}` },
    ], { onEvent: (event) => events.push(event) });
    assert.equal(result.answer, "See old and user.");
    assert.equal(shown(events), result.answer);
    assert.ok(!events.some((e) => e.type === "citation"));
  });

  test(`${provider}: preload and every earlier tool round supply only sent citations`, async (t) => {
    let round = 0;
    let sentUrls: string[] = [];
    setup(t, provider, (p, body) => {
      const sent = outputs(p, body);
      assert.equal(sent.length, round + 1);
      round++;
      if (round <= 2) return reply(p, { text: "Checking…", calls: [`round_${round}`] });
      sentUrls = sent.flatMap(stream.urlsIn);
      const raw = [...stream.urlsIn(JSON.stringify(search("round_1"))), ...stream.urlsIn(JSON.stringify(search("round_2")))];
      const omitted = raw.find((url) => !sentUrls.includes(url))!;
      assert.ok(omitted);
      return reply(p, { text: [...new Set([...sentUrls, omitted])].map((url) => `[source](${url})`).join(" · ") });
    });
    const { askAgent } = agent(async (name, args) => ({ ok: true, result: name === "get_story" ? { story: story("focused", 9000), timeline: [] } : search(String((args as { query: string }).query)) }));
    const events: stream.AskEvent[] = [];
    const result = await askAgent(question, { storyKey: "focused", onEvent: (e) => events.push(e) });
    assert.equal(round, 3);
    assert.ok(events.some((e) => e.type === "discard"));
    assert.equal(shown(events), result.answer);
    assert.deepEqual(new Set(stream.urlsIn(result.answer)), new Set(sentUrls));
    assert.deepEqual(new Set(events.filter((e) => e.type === "citation").map((e) => e.url)), new Set(sentUrls));
    assert.ok(result.complete);
  });
}

for (const footer of [false, true]) {
  test(`fallback repacks preload and all earlier rounds, including ${footer ? "default" : "inline"} citations`, async (t) => {
    let openaiRound = 0;
    let before: string[] = [];
    let after: string[] = [];
    const web = "https://web.example/openai-only";
    const events: stream.AskEvent[] = [];
    setup(t, "openai", (p, body) => {
      const sent = outputs(p, body);
      if (p === "openai") {
        openaiRound++;
        if (openaiRound <= 2) return reply(p, { calls: [`round_${openaiRound}`], web: [web] });
        assert.ok(body.input!.some((m) => m.type === "web_search_call"));
        before = sent;
        return new Response("unavailable", { status: 403 });
      }
      after = sent;
      assert.equal(after.length, 3);
      assert.ok(body.messages!.every((m) => !("items" in m) && !("result" in m)));
      assert.ok(!JSON.stringify(body).includes(web));
      const urls = new Set(after.flatMap(stream.urlsIn));
      const dropped = before.flatMap(stream.urlsIn).find((url) => !urls.has(url))!;
      assert.ok(dropped);
      assert.ok(!JSON.stringify(body).includes(dropped));
      const text = footer ? "Here is the news." : [...urls, dropped, web].map((url) => `[source](${url})`).join(" · ");
      return reply(p, { text });
    });
    const { askAgent } = agent(async (name, args) => ({ ok: true, result: name === "get_story" ? { story: story("focused", 9000), timeline: [] } : search(String((args as { query: string }).query)) }));
    const result = await askAgent(question, { storyKey: "focused", onEvent: (e) => events.push(e) });
    assert.equal(openaiRound, 3);
    assert.equal(shown(events), result.answer);
    const sentUrls = new Set(after.flatMap(stream.urlsIn));
    const answerUrls = stream.urlsIn(result.answer);
    assert.ok(answerUrls.length > 0);
    assert.ok(answerUrls.every((url) => sentUrls.has(url)));
    assert.ok(!result.answer.includes(web));
    if (footer) {
      const cites: string[] = [];
      after.forEach((content) => packing.collectCites(JSON.parse(content), cites));
      assert.equal(result.answer, `Here is the news.\n\nSources: ${[...new Set(cites)].slice(0, 5).join(" · ")}`);
    }
  });
}

test("OpenAI retains web-search citations across earlier tool rounds", async (t) => {
  const web = "https://web.example/checked";
  let round = 0;
  setup(t, "openai", (p, body) => {
    outputs(p, body);
    if (round++ === 0) return reply(p, { web: [web], calls: ["news"] });
    assert.ok(body.input!.some((m) => m.type === "web_search_call"));
    return reply(p, { text: `[web](${web})` });
  });
  const { askAgent } = agent(async () => ({ ok: true, result: search("news") }));
  const events: stream.AskEvent[] = [];
  const result = await askAgent(question, { onEvent: (e) => events.push(e) });
  assert.equal(result.answer, `[web](${web})`);
  assert.equal(shown(events), result.answer);
  assert.ok(events.some((e) => e.type === "citation" && e.url === web));
});
