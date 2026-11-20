import assert from "node:assert/strict";
import test from "node:test";

import { MAX_MESSAGE, parseFeedback } from "./feedback.ts";

const TOKEN = "abcDEF123_-abcDEF123_-abcDEF123_";
const ID = "0b8f6c1e-2a3d-4e5f-8a9b-0c1d2e3f4a5b";

test("a brief rating keeps a well-formed token", () => {
  assert.deepEqual(parseFeedback({ kind: "brief_rating", date: "2026-11-19", rating: "good", token: TOKEN }), {
    kind: "brief_rating", date: "2026-11-19", rating: "good", token: TOKEN,
  });
});

test("a brief rating with a missing or malformed token is recorded without one", () => {
  for (const token of [undefined, "", "x", "has spaces in it here!", "a".repeat(65), 42]) {
    const parsed = parseFeedback({ kind: "brief_rating", date: "2026-11-19", rating: "bad", token });
    assert.deepEqual(parsed, { kind: "brief_rating", date: "2026-11-19", rating: "bad", token: null });
  }
});

test("a brief rating needs a real date and a known rating", () => {
  for (const date of ["2026-02-31", "19-11-2026", "2026-11-19T00:00:00Z", "", undefined]) {
    assert.equal(parseFeedback({ kind: "brief_rating", date, rating: "ok" }), null, String(date));
  }
  for (const rating of ["great", "GOOD", "toString", "", undefined]) {
    assert.equal(parseFeedback({ kind: "brief_rating", date: "2026-11-19", rating }), null, String(rating));
  }
});

test("a story report needs a valid key and a message within the limit", () => {
  assert.deepEqual(parseFeedback({ kind: "story_report", story: "a1b2c3d4e5f6", message: "  Wrong date.  " }), {
    kind: "story_report", storyKey: "a1b2c3d4e5f6", date: null, message: "Wrong date.",
  });
  assert.deepEqual(
    parseFeedback({ kind: "story_report", story: "a1b2c3d4e5f6", date: "2026-11-19", message: "x" }),
    { kind: "story_report", storyKey: "a1b2c3d4e5f6", date: "2026-11-19", message: "x" },
  );
  assert.equal(parseFeedback({ kind: "story_report", story: "../etc", message: "x" }), null);
  assert.equal(parseFeedback({ kind: "story_report", story: "a1b2c3d4e5f6", message: "   " }), null);
  assert.equal(parseFeedback({ kind: "story_report", story: "a1b2c3d4e5f6", date: "soon", message: "x" }), null);
  assert.ok(parseFeedback({ kind: "story_report", story: "a1b2c3d4e5f6", message: "x".repeat(MAX_MESSAGE) }));
  assert.equal(parseFeedback({ kind: "story_report", story: "a1b2c3d4e5f6", message: "x".repeat(MAX_MESSAGE + 1) }), null);
});

test("a note on a rating needs the row's uuid and a message", () => {
  assert.deepEqual(parseFeedback({ kind: "note", id: ID, message: "More AI please" }), {
    kind: "note", id: ID, message: "More AI please",
  });
  assert.equal(parseFeedback({ kind: "note", id: "1", message: "x" }), null);
  assert.equal(parseFeedback({ kind: "note", id: ID, message: "" }), null);
});

test("anything else is rejected", () => {
  for (const body of [null, "good", [], {}, { kind: "spam" }]) assert.equal(parseFeedback(body), null);
});
