import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";

register("./test-support/server-loader.mjs", import.meta.url);
const { renderBrief } = await import("./server/brief-email.ts");

const TOKEN = "abcDEF123_-abcDEF123_-abcDEF123_";

test("the welcome brief carries the rating links above its footer", () => {
  const story = {
    headline: "A", summary: "", why_it_matters: "", topic: "ai", published: "2026-11-19", sources: [], score: 1, importance: 1,
  };
  const { html, text } = renderBrief({ date: "2026-11-19", stories: [story] }, "https://r.example", TOKEN);
  for (const [r, label] of [["good", "Nailed it"], ["ok", "Average"], ["bad", "Missed the mark"]]) {
    const url = `https://r.example/feedback?d=2026-11-19&r=${r}&t=${TOKEN}`;
    assert.ok(text.includes(`${label}: ${url}`), label);
    assert.ok(html.includes(url.replaceAll("&", "&amp;")), label);
  }
  assert.ok(text.indexOf("Reply to this email with a story we missed.") < text.indexOf("Read on the web:"));
  assert.ok(html.indexOf("Missed the mark") < html.indexOf("Read this brief on the web"));
});
