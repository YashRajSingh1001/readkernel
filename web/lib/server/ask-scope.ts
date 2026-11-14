import "server-only";

// Keeps Ask ReadKernel to tech and AI news. Three layers:
// 1. looksLikeCode(): pasted code or error output is turned away before any AI call.
// 2. The system prompt (agent.ts) tells the AI to reply OFF_TOPIC to anything
//    else, such as coding help, homework or general knowledge.
// 3. AnswerGuard (lib/ask-stream.ts) stops the streamed answer the moment it
//    carries that marker or a code block, before any of it is shown, and the
//    answer becomes OFF_TOPIC_REPLY, so a tricked AI still can't hand out code.

export { OFF_TOPIC_MARKER } from "../ask-stream";

export const OFF_TOPIC_REPLY =
  "I can only help with tech and AI news, so I can't answer that. Try asking what's happened with a company, product or topic, for example: What has Nvidia been up to this week?";

// Lines that read as source code, not as a sentence about the news. Case-sensitive,
// so a sentence starting "Import" or "Return" isn't mistaken for code.
const CODE_LINE =
  /^\s*(?:def |class \w+[:(]|import \w|from \w+ import |#include|function\s*\w*\s*\(|(?:const|let|var) \w+\s*=|public |private |return\b|(?:SELECT|select) .+ (?:FROM|from) |<\/?\w+[^>]*>$|[{}]\s*$|.*;\s*$|.*\)\s*\{\s*$|.*=>\s*\{?\s*$)/;

/** True for a message with pasted code or an error trace. Kept narrow: a news question that names Python or Copilot passes. */
export function looksLikeCode(text: string): boolean {
  if (/```/.test(text)) return true;
  if (/Traceback \(most recent call last\)|^\s+at \S+ \(.+:\d+:\d+\)$|\b\w+(?:Error|Exception): .+\n/m.test(text)) return true;
  const lines = text.split("\n").filter((l) => l.trim());
  return lines.filter((l) => CODE_LINE.test(l)).length >= 2;
}
