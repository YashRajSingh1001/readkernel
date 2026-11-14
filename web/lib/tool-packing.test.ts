import assert from "node:assert/strict";
import test from "node:test";

import { urlsIn } from "./ask-stream.ts";
import { packMessages, packToolResult } from "./tool-packing.ts";

const OPENAI = 12_000;
const GROQ = 4_000;

function story(i: number, summary = 400) {
  const url = `https://news.example.com/story-${i}`;
  return {
    story_key: `k${i}`,
    headline: `Headline number ${i}`,
    summary: `Summary ${i} `.padEnd(summary, "x"),
    sources: [{ name: `Outlet ${i}`, url }],
    cite: `[Outlet ${i}](${url})`,
  };
}

function search(n: number, summary = 400) {
  return { query: "nvidia", stories: Array.from({ length: n }, (_, i) => story(i, summary)), company_blog_posts: [] };
}

type Parsed = { stories: ReturnType<typeof story>[]; omitted_items?: number; size_note?: string };

test("small results are sent whole and unchanged", () => {
  const result = search(2);
  const packed = packToolResult(result, OPENAI);
  assert.deepEqual(JSON.parse(packed.content), result);
  assert.equal(packed.omitted, 0);
});

test("packed output is valid JSON within each budget", () => {
  for (const budget of [OPENAI, GROQ, 1_000, 300, 120, 20]) {
    for (const result of [search(40), search(3, 5_000), { story: story(1, 9_000), timeline: [] }, "x".repeat(20_000), [story(1), story(2)]]) {
      const packed = packToolResult(result, budget);
      assert.ok(packed.content.length <= budget, `${packed.content.length} > ${budget}`);
      assert.doesNotThrow(() => JSON.parse(packed.content));
    }
  }
});

test("whole items are kept, and the omitted count is reported", () => {
  const result = search(40);
  const packed = packToolResult(result, GROQ);
  const parsed = JSON.parse(packed.content) as Parsed;
  assert.ok(parsed.stories.length > 0 && parsed.stories.length < 40);
  parsed.stories.forEach((s, i) => assert.deepEqual(s, result.stories[i]));
  assert.equal(parsed.omitted_items, 40 - parsed.stories.length);
  assert.equal(packed.omitted, parsed.omitted_items);
  assert.match(parsed.size_note!, /left out/);
});

test("allowed URLs and default citations are exactly those in the sent packet", () => {
  const result = search(40);
  for (const budget of [OPENAI, GROQ]) {
    const packed = packToolResult(result, budget);
    const parsed = JSON.parse(packed.content) as Parsed;
    const sent = parsed.stories.map((s) => s.sources[0].url);
    assert.deepEqual(new Set(packed.urls), new Set(sent));
    assert.deepEqual(new Set(packed.urls), new Set(urlsIn(packed.content)));
    assert.deepEqual(packed.cites, parsed.stories.map((s) => s.cite));
    for (const s of result.stories.slice(parsed.stories.length)) assert.ok(!packed.urls.includes(s.sources[0].url));
  }
});

test("repacking earlier rounds for the fallback provider drops URLs that no longer fit", () => {
  const messages = [
    { role: "system", content: "rules" },
    { role: "user", content: "what's new with nvidia?" },
    { role: "assistant", content: null },
    { role: "tool", tool_call_id: "a", content: "", result: search(20) },
    { role: "tool", tool_call_id: "b", content: '{"error":"Too many tools at once; use fewer."}' },
  ];
  const openai = packMessages(messages, OPENAI);
  const groq = packMessages(messages, GROQ);
  const groqTool = groq.messages[3].content!;

  assert.ok(groqTool.length <= GROQ);
  assert.doesNotThrow(() => JSON.parse(groqTool));
  assert.deepEqual(new Set(groq.urls), new Set(urlsIn(groqTool)));
  assert.ok(groq.urls.length < openai.urls.length);
  const dropped = openai.urls.filter((u) => !groq.urls.includes(u));
  assert.ok(dropped.length > 0);
  for (const u of dropped) assert.ok(!groq.messages.some((m) => (m.content ?? "").includes(u)));
  assert.ok(groq.cites.every((c) => urlsIn(c).every((u) => groq.urls.includes(u))));
  assert.equal(groq.messages[4].content, messages[4].content);
  assert.equal(messages[3].content, "");
  assert.ok(!("result" in JSON.parse(groqTool)));
});

test("a single item larger than the budget is shortened but keeps valid JSON and its URL", () => {
  const big = { query: "nvidia", stories: [story(1, 20_000)], company_blog_posts: [] };
  const packed = packToolResult(big, GROQ);
  const parsed = JSON.parse(packed.content) as Parsed;
  assert.ok(packed.content.length <= GROQ);
  assert.equal(parsed.stories.length, 1);
  assert.ok(parsed.stories[0].summary.length < 20_000);
  assert.ok(parsed.stories[0].summary.endsWith("…"));
  assert.equal(parsed.stories[0].cite, big.stories[0].cite);
  assert.deepEqual(packed.urls, [big.stories[0].sources[0].url, big.stories[0].sources[0].url]);
  assert.match(parsed.size_note!, /shortened/);
});

test("an item that can't be shortened enough is dropped along with its URL", () => {
  const url = `https://news.example.com/${"p".repeat(500)}`;
  const big = { stories: [{ headline: "h", sources: [{ name: "n", url }], cite: `[n](${url})` }] };
  const packed = packToolResult(big, 300);
  const parsed = JSON.parse(packed.content) as Parsed;
  assert.equal(parsed.stories.length, 0);
  assert.equal(parsed.omitted_items, 1);
  assert.deepEqual(packed.urls, []);
  assert.deepEqual(packed.cites, []);
});

test("a large single story (get_story) keeps its URL and timeline fits what's left", () => {
  const result = { story: story(1, 6_000), timeline: Array.from({ length: 30 }, (_, i) => ({ date: "2026-10-01", headline: `t${i}`, summary: "s".repeat(200), story_key: `t${i}` })) };
  const packed = packToolResult(result, GROQ);
  const parsed = JSON.parse(packed.content) as { story: { cite: string }; timeline: unknown[]; omitted_items: number };
  assert.ok(packed.content.length <= GROQ);
  assert.equal(parsed.story.cite, result.story.cite);
  assert.equal(parsed.omitted_items, 30 - parsed.timeline.length);
  assert.deepEqual(packed.cites, [result.story.cite]);
});
