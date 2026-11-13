// Runs the fixed Ask questions in cases.json against /api/ask and writes a
// markdown report to web/.ask-runs/. See README.md.
//
//   node scripts/ask-check/run.mjs [--base http://localhost:3000] [--only page|typed|general|scope] [--case <id>] [--stream]
//
// --stream asks the way the chat does (NDJSON events) and also checks the
// stream itself: it ends in "done", the streamed text adds up to the final
// answer, and no OFF_TOPIC marker or code fence was ever streamed.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const base = flag("base", "http://localhost:3000").replace(/\/$/, "");
const only = flag("only", "");
const caseId = flag("case", "");
const stream = argv.includes("--stream");

const LIMIT_WAIT_MS = 60_000; // /api/ask allows 12 questions per 10 minutes
const BUSY_WAIT_MS = 30_000; // the AI was busy or out of quota ("resting"); not an answer to grade
const PAUSE_MS = 15_000; // between questions, so one answer's tokens don't starve the next

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ask(question, story, history = []) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const started = Date.now();
    const res = await fetch(`${base}/api/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(stream ? { Accept: "application/x-ndjson" } : {}) },
      body: JSON.stringify({ messages: [...history, { role: "user", content: question }], ...(story ? { story } : {}) }),
    });
    if (stream && (res.headers.get("content-type") ?? "").includes("ndjson")) {
      const { data, streamCheck } = await readStream(res);
      if (data.retryBusy && attempt < 3) {
        console.log(`  AI busy; waiting ${BUSY_WAIT_MS / 1000}s`);
        await sleep(BUSY_WAIT_MS);
        continue;
      }
      return { status: data.error ? 503 : 200, ms: Date.now() - started, answer: data.answer ?? data.error ?? "", steps: data.steps ?? [], streamCheck };
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 429) {
      console.log(`  rate limited; waiting ${LIMIT_WAIT_MS / 1000}s`);
      await sleep(LIMIT_WAIT_MS);
      continue;
    }
    if (res.status === 503 && attempt < 3) {
      console.log(`  AI busy; waiting ${BUSY_WAIT_MS / 1000}s`);
      await sleep(BUSY_WAIT_MS);
      continue;
    }
    return { status: res.status, ms: Date.now() - started, answer: data.answer ?? data.error ?? "", steps: data.steps ?? [] };
  }
  return { status: 429, ms: 0, answer: "Still rate limited after retries.", steps: [] };
}

/** Reads the NDJSON event stream; returns the final answer and what the stream itself did. */
async function readStream(res) {
  const text = await res.text();
  const events = text.split("\n").filter(Boolean).map((l) => JSON.parse(l));
  let shown = "";
  const problems = [];
  for (const e of events) {
    if (e.type === "delta") {
      shown += e.text;
      if (/OFF_TOPIC|```/.test(shown)) problems.push("blocked text was streamed");
    }
    if (e.type === "discard") shown = "";
  }
  const end = events.at(-1);
  if (!end || (end.type !== "done" && end.type !== "error")) problems.push("stream ended without done/error");
  const done = end?.type === "done" ? end : null;
  // A declined question's fixed reply arrives in done, with nothing streamed.
  if (done && shown && shown !== done.answer) problems.push("streamed text differs from the final answer");
  const data = done ?? { error: end?.message ?? "no answer", retryBusy: end?.type === "error" && /resting/.test(end.message ?? "") };
  return {
    data,
    streamCheck: { events: events.length, tools: events.filter((e) => e.type === "tool" && e.state === "started").length, ok: problems.length === 0, problems: [...new Set(problems)] },
  };
}

// The fixed reply for questions outside tech and AI news (lib/server/ask-scope.ts).
const DECLINED = /^I can only help with tech and AI news/;

const NOT_COVERED = /hasn['’]t covered|haven['’]t covered|no (?:coverage|stories)|doesn['’]t (?:name|mention)|not covered|couldn['’]t find/i;

function checks(result) {
  const links = [...result.answer.matchAll(/\]\((https?:\/\/[^\s)]+)\)/g)].map((m) => m[1]);
  const words = result.answer.split(/\s+/).filter(Boolean).length;
  return {
    answered: result.status === 200,
    linked: links.length > 0,
    links: links.length,
    domains: [...new Set(links.map((u) => new URL(u).hostname.replace(/^www\./, "")))],
    words,
    under_limit: words <= 220, // the prompt asks for 180; allow a little for links and the Sources line
    says_not_covered: NOT_COVERED.test(result.answer),
    tool_calls: result.steps.length,
    declined: DECLINED.test(result.answer),
  };
}

function plan(cases) {
  const runs = [];
  for (const c of cases.story_cases) {
    if (!only || only === "page") runs.push({ id: c.id, variant: "page", question: c.question, story: c.story, headline: c.headline });
    if (!only || only === "typed") {
      runs.push({ id: c.id, variant: "typed", question: `I just read "${c.headline}". ${c.question}`, headline: c.headline });
    }
  }
  if (!only || only === "general") {
    for (const c of cases.general_cases) runs.push({ id: c.id, variant: "general", question: c.question });
  }
  if (!only || only === "scope") {
    for (const c of cases.scope_cases) runs.push({ ...c, variant: "scope" });
  }
  return caseId ? runs.filter((r) => r.id === caseId) : runs;
}

const cases = JSON.parse(await readFile(path.join(here, "cases.json"), "utf8"));
const runs = plan(cases);
console.log(`Asking ${runs.length} questions at ${base}`);

const results = [];
for (const [i, run] of runs.entries()) {
  console.log(`${i + 1}/${runs.length} ${run.id} (${run.variant})`);
  const result = await ask(run.question, run.story, run.history);
  results.push({ ...run, ...result, checks: checks(result) });
  if (i < runs.length - 1) await sleep(PAUSE_MS);
}

const tick = (b) => (b ? "yes" : "**no**");
// Scope cases: did Ask decline exactly the questions it should?
const scope = (r) => (r.expect ? (r.checks.declined === (r.expect === "decline") ? `ok (${r.expect})` : `**wrong** (wanted ${r.expect})`) : r.checks.declined ? "declined" : "");
const lines = [
  `# Ask check: ${new Date().toISOString()}`,
  "",
  `Base: ${base}. Read each answer against the checklist in scripts/ask-check/README.md.`,
  "",
  `| case | variant | answered | linked | links | words | says not covered | scope | tool calls | seconds |${stream ? " stream |" : ""}`,
  `| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |${stream ? " --- |" : ""}`,
  ...results.map(
    (r) =>
      `| ${r.id} | ${r.variant} | ${tick(r.checks.answered)} | ${tick(r.checks.linked)} | ${r.checks.links} | ${r.checks.words}${r.checks.under_limit ? "" : " (long)"} | ${r.checks.says_not_covered ? "yes" : "no"} | ${scope(r)} | ${r.checks.tool_calls} | ${(r.ms / 1000).toFixed(1)} |${stream ? ` ${r.streamCheck ? (r.streamCheck.ok ? "ok" : `**${r.streamCheck.problems.join("; ")}**`) : "json"} |` : ""}`,
  ),
  "",
];
for (const r of results) {
  lines.push(
    `## ${r.id} (${r.variant})`,
    "",
    ...(r.headline ? [`Story: ${r.headline}${r.story ? ` (\`${r.story}\`)` : ""}`, ""] : []),
    ...(r.history ? r.history.map((t) => `**${t.role === "user" ? "Q" : "A"} (earlier):** ${t.content}`).concat("") : []),
    `**Q:** ${r.question}`,
    "",
    `**Tools:** ${r.steps.map((s) => `${s.tool}(${JSON.stringify(s.args)})`).join(" → ") || "none"}`,
    "",
    `**Sources linked:** ${r.checks.domains.join(", ") || "none"}`,
    "",
    r.answer,
    "",
  );
}

const outDir = path.join(here, "..", "..", ".ask-runs");
await mkdir(outDir, { recursive: true });
const out = path.join(outDir, `${new Date().toISOString().replace(/[:.]/g, "-")}.md`);
await writeFile(out, lines.join("\n"));
console.log(`Report: ${out}`);
