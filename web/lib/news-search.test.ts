import assert from "node:assert/strict";
import test from "node:test";

import { countResult } from "./ask-stream.ts";
import { broaderQueries, searchArchive, shouldCacheAnswer } from "./news-search.ts";

type Item = { id: string };

function fake(results: (query: string) => Item[] | Error) {
  const calls: string[] = [];
  const search = async (query: string) => {
    calls.push(query);
    const out = results(query);
    if (out instanceof Error) throw out;
    return out;
  };
  return { calls, search };
}

const show = { story: (s: Item) => s.id, post: (p: Item) => p.id };

async function quietly<T>(work: () => Promise<T>): Promise<T> {
  const original = console.error;
  console.error = () => {};
  try {
    return await work();
  } finally {
    console.error = original;
  }
}

const QUERY = "nvidia blackwell chips";

test("a failed company post lookup is reported as unavailable, not as an empty list", async () => {
  const stories = fake(() => [{ id: "s1" }]);
  const posts = fake(() => new Error("Supabase 500: secret detail"));
  const result = await quietly(() => searchArchive(QUERY, { stories: stories.search, posts: posts.search }, show));
  assert.deepEqual(result.company_blog_posts, { unavailable: true });
  assert.deepEqual(result.stories, ["s1"]);
  assert.match(String(result.note), /not searched/);
  assert.doesNotMatch(JSON.stringify(result), /Supabase|secret|500/);
});

test("a failed lookup is not broadened, even when the other side is empty", async () => {
  const stories = fake(() => []);
  const posts = fake(() => new Error("down"));
  const result = await quietly(() => searchArchive(QUERY, { stories: stories.search, posts: posts.search }, show));
  assert.deepEqual(stories.calls, [QUERY]);
  assert.deepEqual(posts.calls, [QUERY]);
  assert.deepEqual(result.stories, []);
  assert.deepEqual(result.company_blog_posts, { unavailable: true });
  assert.equal("matched_query" in result, false);
});

test("a failed story lookup is treated the same way", async () => {
  const stories = fake(() => new Error("down"));
  const posts = fake(() => []);
  const result = await quietly(() => searchArchive(QUERY, { stories: stories.search, posts: posts.search }, show));
  assert.deepEqual(stories.calls, [QUERY]);
  assert.deepEqual(result.stories, { unavailable: true });
  assert.deepEqual(result.company_blog_posts, []);
});

test("the unavailable marker comes before the result lists, so trimming the JSON can't cut it off", async () => {
  const stories = fake(() => Array.from({ length: 20 }, (_, i) => ({ id: `s${i}` })));
  const posts = fake(() => new Error("down"));
  const result = await quietly(() => searchArchive(QUERY, { stories: stories.search, posts: posts.search }, show));
  const json = JSON.stringify(result);
  assert.ok(json.indexOf('"company_blog_posts":{"unavailable":true}') < json.indexOf('"stories":['));
});

test("when both lookups fail the tool fails, and nothing is broadened", async () => {
  const stories = fake(() => new Error("stories down"));
  const posts = fake(() => new Error("posts down"));
  await quietly(() =>
    assert.rejects(searchArchive(QUERY, { stories: stories.search, posts: posts.search }, show), /stories down/),
  );
  assert.equal(stories.calls.length, 1);
  assert.equal(posts.calls.length, 1);
});

test("a search that works but finds nothing still broadens the query as before", async () => {
  const stories = fake((q) => (q === "nvidia" ? [{ id: "s1" }] : []));
  const posts = fake(() => []);
  const result = await searchArchive(QUERY, { stories: stories.search, posts: posts.search }, show);
  assert.deepEqual(stories.calls, broaderQueries(QUERY).slice(0, stories.calls.length));
  assert.deepEqual(stories.calls, [QUERY, "nvidia blackwell", "nvidia"]);
  assert.deepEqual(posts.calls, stories.calls);
  assert.equal(result.matched_query, "nvidia");
  assert.deepEqual(result.stories, ["s1"]);
  assert.deepEqual(result.company_blog_posts, []);
  assert.match(String(result.note), /Nothing matched every word/);
});

test("a search that works but finds nothing at all returns empty lists after every attempt", async () => {
  const stories = fake(() => []);
  const posts = fake(() => []);
  const result = await searchArchive(QUERY, { stories: stories.search, posts: posts.search }, show);
  assert.equal(stories.calls.length, broaderQueries(QUERY).length);
  assert.deepEqual(result, { query: QUERY, stories: [], company_blog_posts: [] });
});

test("answers given while a lookup was unavailable are not cached", () => {
  assert.equal(shouldCacheAnswer({ complete: true }), true);
  assert.equal(shouldCacheAnswer({ complete: true, degraded: false }), true);
  assert.equal(shouldCacheAnswer({ complete: true, degraded: true }), false);
  assert.equal(shouldCacheAnswer({ complete: false }), false);
});

test("the Ask step for a partly unavailable search is not shown as 'nothing found'", () => {
  const counts = countResult("search_news", { query: "x", company_blog_posts: { unavailable: true }, stories: [] });
  assert.equal(counts.unavailable, true);
  assert.equal(counts.empty, undefined);
  assert.equal(countResult("search_news", { query: "x", stories: [], company_blog_posts: [] }).empty, true);
});
