import assert from "node:assert/strict";
import { register } from "node:module";
import test, { type TestContext } from "node:test";

register("./test-support/server-loader.mjs", import.meta.url);
const { POST } = await import("../app/api/feedback/route.ts");
const TOKEN = "abcDEF123_-abcDEF123_-abcDEF123_";
const SUBSCRIBER = "11111111-2222-4333-8444-555555555555";
const ROW = "0b8f6c1e-2a3d-4e5f-8a9b-0c1d2e3f4a5b";

type Call = { path: string; search: string; method: string; prefer: string | null; body: unknown };

function database(t: TestContext, configured = true) {
  const env = { SUPABASE_URL: configured ? "https://database.invalid" : "", SUPABASE_SECRET_KEY: configured ? "test-admin" : "" };
  for (const [key, value] of Object.entries(env)) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
  t.mock.method(console, "error", () => {});
  const calls: Call[] = [];
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, "database.invalid");
    const headers = new Headers(init?.headers);
    calls.push({
      path: url.pathname.split("/").at(-1)!, search: url.search, method: init?.method ?? "GET",
      prefer: headers.get("Prefer"), body: init?.body ? JSON.parse(String(init.body)) : null,
    });
    if (url.pathname.endsWith("/subscribers")) {
      return Response.json(url.searchParams.get("token") === `eq.${TOKEN}` ? [{ id: SUBSCRIBER }] : []);
    }
    if (init?.method === "POST" && headers.get("Prefer")?.includes("return=representation")) return Response.json([{ id: ROW }]);
    return new Response(null, { status: 204 });
  });
  return calls;
}

function post(body: unknown) {
  return POST(new Request("https://readkernel.example/api/feedback", { method: "POST", body: JSON.stringify(body) }));
}

test("without the admin database the API answers 503 and writes nothing", async (t) => {
  const calls = database(t, false);
  const res = await post({ kind: "brief_rating", date: "2026-11-19", rating: "good", token: TOKEN });
  assert.equal(res.status, 503);
  assert.match((await res.json()).error, /isn't available/);
  assert.equal(calls.length, 0);
});

test("a rating from a known subscriber upserts one row per subscriber and edition", async (t) => {
  const calls = database(t);
  const res = await post({ kind: "brief_rating", date: "2026-11-19", rating: "bad", token: TOKEN });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { id: ROW });
  const write = calls.find((c) => c.path === "feedback")!;
  assert.equal(write.method, "POST");
  assert.equal(new URLSearchParams(write.search).get("on_conflict"), "edition_date,subscriber_id");
  assert.match(write.prefer!, /resolution=merge-duplicates/);
  assert.deepEqual(write.body, { kind: "brief_rating", edition_date: "2026-11-19", rating: "bad", subscriber_id: SUBSCRIBER });
});

test("a malformed or unknown token still records the rating without a subscriber", async (t) => {
  for (const token of ["x", "unknownTOKEN_unknownTOKEN_1234"]) {
    const calls = database(t);
    assert.equal((await post({ kind: "brief_rating", date: "2026-11-19", rating: "ok", token })).status, 200);
    assert.equal((calls.find((c) => c.path === "feedback")!.body as { subscriber_id: unknown }).subscriber_id, null);
    t.mock.restoreAll();
  }
});

test("a note only updates the message on that rating row", async (t) => {
  const calls = database(t);
  assert.equal((await post({ kind: "note", id: ROW, message: "More security" })).status, 200);
  assert.deepEqual(calls, [{
    path: "feedback", search: `?id=eq.${ROW}&kind=eq.brief_rating`, method: "PATCH",
    prefer: "return=minimal", body: { message: "More security" },
  }]);
});

test("a story report is inserted as its own row", async (t) => {
  const calls = database(t);
  assert.equal((await post({ kind: "story_report", story: "a1b2c3d4e5f6", date: "2026-11-19", message: "Wrong CEO" })).status, 200);
  assert.deepEqual(calls[0].body, { kind: "story_report", story_key: "a1b2c3d4e5f6", edition_date: "2026-11-19", message: "Wrong CEO" });
});

test("bad input gets a 400 and the honeypot is accepted silently, both without writing", async (t) => {
  const calls = database(t);
  assert.equal((await post({ kind: "brief_rating", date: "2026-11-19", rating: "meh" })).status, 400);
  assert.equal((await post({ kind: "story_report", story: "a1b2c3d4e5f6", message: "x".repeat(1001) })).status, 400);
  assert.equal(
    (await POST(new Request("https://readkernel.example/api/feedback", { method: "POST", body: "not json" }))).status,
    400,
  );
  const bot = await post({ kind: "story_report", story: "a1b2c3d4e5f6", message: "buy now", company: "Spam Inc" });
  assert.equal(bot.status, 200);
  assert.equal(calls.length, 0);
});
