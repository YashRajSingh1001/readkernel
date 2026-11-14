import "server-only";

export { OFF_TOPIC_MARKER } from "../ask-stream";

export const OFF_TOPIC_REPLY =
  "I can only help with tech and AI news, so I can't answer that. Try asking what's happened with a company, product or topic, for example: What has Nvidia been up to this week?";

const CODE_LINE =
  /^\s*(?:def |class \w+[:(]|import \w|from \w+ import |#include|function\s*\w*\s*\(|(?:const|let|var) \w+\s*=|public |private |return\b|(?:SELECT|select) .+ (?:FROM|from) |<\/?\w+[^>]*>$|[{}]\s*$|.*;\s*$|.*\)\s*\{\s*$|.*=>\s*\{?\s*$)/;

export function looksLikeCode(text: string): boolean {
  if (/```/.test(text)) return true;
  if (/Traceback \(most recent call last\)|^\s+at \S+ \(.+:\d+:\d+\)$|\b\w+(?:Error|Exception): .+\n/m.test(text)) return true;
  const lines = text.split("\n").filter((l) => l.trim());
  return lines.filter((l) => CODE_LINE.test(l)).length >= 2;
}
