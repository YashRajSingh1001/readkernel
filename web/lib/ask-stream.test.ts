// node --test lib/ask-stream.test.ts   (npm test)

import assert from "node:assert/strict";
import test from "node:test";

import { AnswerGuard, countResult, readEvents, type AskEvent } from "./ask-stream.ts";

const BLOOMBERG = "https://www.bloomberg.com/news/nvidia-1";

/** Feed text in the given chunks; return every delta, the citations and the final text. */
function run(chunks: string[], known = [BLOOMBERG]) {
  const guard = new AnswerGuard(known);
  const deltas: string[] = [];
  const citations: string[] = [];
  for (const c of chunks) {
    const out = guard.push(c);
    deltas.push(out.delta);
    citations.push(...out.citations.map((x) => x.url));
  }
  const end = guard.finish();
  deltas.push(end.delta);
  citations.push(...end.citations.map((x) => x.url));
  return { guard, deltas, citations, text: guard.text };
}

/** Every way of splitting `s` into two chunks, plus one char at a time. */
function splits(s: string): string[][] {
  const out = [[...s]];
  for (let i = 1; i < s.length; i++) out.push([s.slice(0, i), s.slice(i)]);
  return out;
}

test("deltas joined equal the final text, however the model splits it", () => {
  const answer = `Nvidia is buying in ([Bloomberg](${BLOOMBERG})).  \n\n- One **bold** point\n- Two [1] points 【6†source】 here`;
  const expected = `Nvidia is buying in ([Bloomberg](${BLOOMBERG})).\n\n- One **bold** point\n- Two [1] points here`;
  for (const chunks of splits(answer)) {
    const r = run(chunks);
    assert.equal(r.text, expected);
    assert.equal(r.deltas.join(""), expected);
    assert.deepEqual(r.citations, [BLOOMBERG]);
  }
});

test("a link is never shown half-written", () => {
  const r = run([`See [Bloom`, `berg](https://www.bloo`, `mberg.com/news/nvidia-1) now`]);
  assert.deepEqual(r.deltas, ["See", "", ` [Bloomberg](${BLOOMBERG}) now`, ""]);
});

test("a citation is reported in the same step as the delta that shows its link", () => {
  const guard = new AnswerGuard([BLOOMBERG]);
  assert.deepEqual(guard.push(`Hi [Bloomberg](${BLOOMBERG}`).citations, []);
  const out = guard.push(")");
  assert.deepEqual(out.citations, [{ url: BLOOMBERG, label: "Bloomberg" }]);
  assert.ok(out.delta.includes(BLOOMBERG));
});

test("links the tools never returned keep their words but lose the link", () => {
  const r = run(["Read [this](https://made-up.example/x) and ", `[Bloomberg](${BLOOMBERG}/).`]);
  assert.equal(r.text, `Read this and [Bloomberg](${BLOOMBERG}/).`);
  assert.deepEqual(r.guard.unconfirmed, ["https://made-up.example/x"]);
  assert.deepEqual(r.citations, [`${BLOOMBERG}/`]);
});

test("the off-topic marker never reaches the reader, in any split", () => {
  for (const chunks of splits("OFF_TOPIC")) {
    const r = run(chunks);
    assert.equal(r.deltas.join(""), "");
    assert.ok(r.guard.blocked);
  }
});

test("a code fence stops the stream before any code is shown", () => {
  for (const chunks of splits("Sure:\n```py\nprint(1)\n```")) {
    const r = run(chunks);
    assert.ok(!r.deltas.join("").includes("print"), chunks.join("|"));
    assert.ok(!r.deltas.join("").includes("`"));
    assert.ok(r.guard.blocked);
  }
});

test("ordinary words that start like a marker still come through", () => {
  const r = run(["The CEO", " said OFF", " the record"]);
  assert.equal(r.text, "The CEO said OFF the record");
});

test("an unclosed bracket or 【 is released at the end", () => {
  assert.equal(run(["Note [draft"]).text, "Note [draft");
  assert.equal(run(["Note 【6"]).text, "Note 【6");
});

test("countResult counts what came back", () => {
  assert.deepEqual(countResult("search_news", { query: "x", stories: [1, 2], company_blog_posts: [1] }), { stories: 2, posts: 1 });
  assert.deepEqual(countResult("search_news", { query: "a b", matched_query: "a", stories: [1], company_blog_posts: [] }), {
    stories: 1,
    posts: 0,
    matched_query: "a",
  });
  assert.deepEqual(countResult("search_news", { query: "x", stories: [], company_blog_posts: [] }), { stories: 0, posts: 0, empty: true });
  assert.deepEqual(countResult("get_today_news", { date: "2026-11-13", stories: [1, 2, 3] }), { stories: 3, date: "2026-11-13" });
  assert.deepEqual(countResult("get_story", { story: {}, timeline: [1, 2] }), { stories: 1, timeline: 2 });
  assert.deepEqual(countResult("get_story", { message: "No story with key x." }), { empty: true });
});

test("readEvents handles events split across chunks and multibyte text", async () => {
  const events: AskEvent[] = [
    { type: "delta", text: "Café — naïve ✓ 日本" },
    { type: "status", phase: "thinking", round: 1 },
  ];
  const bytes = new TextEncoder().encode(events.map((e) => JSON.stringify(e) + "\n").join(""));
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      for (let i = 0; i < bytes.length; i += 3) c.enqueue(bytes.slice(i, i + 3));
      c.close();
    },
  });
  const got: AskEvent[] = [];
  for await (const e of readEvents(body)) got.push(e);
  assert.deepEqual(got, events);
});
