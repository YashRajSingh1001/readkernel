import "server-only";

import { adminConfigured, adminRest } from "./admin-db";

export type AskOutcome = "answered" | "cached" | "truncated" | "off_topic" | "no_answer" | "failed" | "stopped";

export class AskUsage {
  provider: "openai" | "groq" = "openai";
  model = process.env.ASK_MODEL || "gpt-6-luna";
  fellBack = false;
  readonly started = Date.now();
  calls = 0;
  reported = 0;
  input = 0;
  cachedInput = 0;
  cacheWrite = 0;
  output = 0;
  reasoning = 0;
  webSearches = 0;
  webActions: Record<string, number> = {};
  steps = 0;

  switchTo(provider: "groq", model: string, fallback: boolean): void {
    this.provider = provider;
    this.model = model;
    this.fellBack = fallback;
  }

  startCall(): void {
    this.calls++;
  }

  webSearch(kind: string): void {
    this.webSearches++;
    this.webActions[kind] = (this.webActions[kind] ?? 0) + 1;
  }

  add(usage: unknown): void {
    const u = usage as {
      input_tokens?: number;
      output_tokens?: number;
      input_tokens_details?: { cached_tokens?: number; cache_write_tokens?: number };
      output_tokens_details?: { reasoning_tokens?: number };
      prompt_tokens?: number;
      completion_tokens?: number;
      prompt_tokens_details?: { cached_tokens?: number };
      completion_tokens_details?: { reasoning_tokens?: number };
    } | null;
    if (!u) return;
    if (typeof u.input_tokens === "number") {
      this.input += u.input_tokens;
      this.output += u.output_tokens ?? 0;
      this.cachedInput += u.input_tokens_details?.cached_tokens ?? 0;
      this.cacheWrite += u.input_tokens_details?.cache_write_tokens ?? 0;
      this.reasoning += u.output_tokens_details?.reasoning_tokens ?? 0;
    } else if (typeof u.prompt_tokens === "number") {
      this.input += u.prompt_tokens;
      this.output += u.completion_tokens ?? 0;
      this.cachedInput += u.prompt_tokens_details?.cached_tokens ?? 0;
      this.reasoning += u.completion_tokens_details?.reasoning_tokens ?? 0;
    } else return;
    this.reported++;
  }
}

function env(): string {
  return process.env.VERCEL_ENV || (process.env.NODE_ENV === "production" ? "production" : "local");
}

export async function recordAskUsage(
  usage: AskUsage,
  outcome: AskOutcome,
  details: { story?: string; suggested: boolean },
): Promise<void> {
  const seconds = Math.round((Date.now() - usage.started) / 100) / 10;
  const unreported = usage.calls - usage.reported;
  console.info(
    `[ask-usage] ${outcome} ${usage.provider}/${usage.model}${usage.fellBack ? " (fallback)" : ""}: ${usage.calls} call(s), ${usage.input} in (${usage.cachedInput} cached, ` +
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
        provider: usage.provider,
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
          ...(usage.fellBack ? { fallback_from: "openai" } : {}),
          ...(usage.webSearches ? { web_actions: usage.webActions } : {}),
        },
      },
    });
  } catch (err) {
    console.warn("[ai-usage] save skipped (run db/migrations/008?)", String(err).slice(0, 160));
  }
}
