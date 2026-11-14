import "server-only";

// What each Ask question costs: the AI's own token counts, added up over every
// model call the question needed, saved to Supabase (ai_usage, from
// db/migrations/008) and printed as one log line. Cost is worked out from
// ai_prices when it's read (views ai_usage_costed and ai_cost_daily).
// Until the migration has run, saving fails quietly and only the log line remains.

import { adminConfigured, adminRest } from "./admin-db";

export type AskOutcome = "answered" | "cached" | "truncated" | "off_topic" | "no_answer" | "failed" | "stopped";

/** Filled in by askAgent while it works; read by the route when the question ends. */
export class AskUsage {
  readonly model = process.env.ASK_MODEL || "gpt-6-luna";
  readonly started = Date.now();
  calls = 0;
  reported = 0; // calls whose usage the AI reported
  input = 0;
  cachedInput = 0;
  cacheWrite = 0;
  output = 0;
  reasoning = 0;
  webSearches = 0;
  // Web search calls by kind (search, open_page, find_in_page, failed). All are
  // counted as billed calls in webSearches; this keeps the split to check against OpenAI's bill.
  webActions: Record<string, number> = {};
  steps = 0;

  /** OpenAI accepted a model request. */
  startCall(): void {
    this.calls++;
  }

  webSearch(kind: string): void {
    this.webSearches++;
    this.webActions[kind] = (this.webActions[kind] ?? 0) + 1;
  }

  /** The `usage` object of an OpenAI Responses reply. */
  add(usage: unknown): void {
    const u = usage as {
      input_tokens?: number;
      output_tokens?: number;
      input_tokens_details?: { cached_tokens?: number; cache_write_tokens?: number };
      output_tokens_details?: { reasoning_tokens?: number };
    } | null;
    if (!u || typeof u.input_tokens !== "number") return;
    this.reported++;
    this.input += u.input_tokens;
    this.output += u.output_tokens ?? 0;
    this.cachedInput += u.input_tokens_details?.cached_tokens ?? 0;
    this.cacheWrite += u.input_tokens_details?.cache_write_tokens ?? 0;
    this.reasoning += u.output_tokens_details?.reasoning_tokens ?? 0;
  }
}

/** Where this server runs, so local tests don't count as production spend. */
function env(): string {
  return process.env.VERCEL_ENV || (process.env.NODE_ENV === "production" ? "production" : "local");
}

/**
 * Logs and saves one question. Never throws, and awaited by the caller, since
 * on Vercel work left running after the response may never finish.
 */
export async function recordAskUsage(
  usage: AskUsage,
  outcome: AskOutcome,
  details: { story?: string; suggested: boolean },
): Promise<void> {
  const seconds = Math.round((Date.now() - usage.started) / 100) / 10;
  const unreported = usage.calls - usage.reported;
  console.info(
    `[ask-usage] ${outcome} ${usage.model}: ${usage.calls} call(s), ${usage.input} in (${usage.cachedInput} cached, ` +
      `${usage.cacheWrite} cache write, ${usage.output} out (${usage.reasoning} reasoning), ` +
      `${usage.webSearches} web search(es) ${JSON.stringify(usage.webActions)}, ${seconds}s` +
      (unreported ? `, ${unreported} call(s) without usage` : ""),
  );
  if (!adminConfigured() || process.env.AI_USAGE_LOG === "off") return;
  try {
    await adminRest("ai_usage", {
      method: "POST",
      prefer: "return=minimal",
      body: {
        source: "ask",
        env: env(),
        provider: "openai",
        model: usage.model,
        calls: usage.calls,
        calls_without_usage: unreported,
        input_tokens: usage.input,
        cached_input_tokens: usage.cachedInput,
        cache_write_tokens: usage.cacheWrite,
        output_tokens: usage.output,
        reasoning_tokens: usage.reasoning,
        web_searches: usage.webSearches,
        outcome,
        details: {
          ...(details.story ? { story: details.story } : {}),
          suggested: details.suggested,
          steps: usage.steps,
          seconds,
          ...(usage.webSearches ? { web_actions: usage.webActions } : {}),
        },
      },
    });
  } catch (err) {
    console.warn("[ai-usage] save skipped (run db/migrations/008?)", String(err).slice(0, 160));
  }
}
