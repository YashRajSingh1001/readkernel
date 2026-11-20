export const RATINGS = { good: "Nailed it", ok: "Average", bad: "Missed the mark" } as const;
export type Rating = keyof typeof RATINGS;

export const MAX_MESSAGE = 1000;

export type Feedback =
  | { kind: "brief_rating"; date: string; rating: Rating; token: string | null }
  | { kind: "story_report"; storyKey: string; date: string | null; message: string }
  | { kind: "note"; id: string; message: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;
const STORY_KEY_RE = /^[a-z0-9-]{6,40}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value);
}

function isRating(value: string): value is Rating {
  return Object.hasOwn(RATINGS, value);
}

function message(value: unknown): string | null {
  const m = text(value);
  return m.length > 0 && m.length <= MAX_MESSAGE ? m : null;
}

export function parseFeedback(body: unknown): Feedback | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;

  if (b.kind === "brief_rating") {
    const date = text(b.date);
    const rating = text(b.rating);
    if (!isDate(date) || !isRating(rating)) return null;
    const token = text(b.token);
    return { kind: "brief_rating", date, rating, token: TOKEN_RE.test(token) ? token : null };
  }

  if (b.kind === "story_report") {
    const storyKey = text(b.story);
    const date = text(b.date);
    const m = message(b.message);
    if (!STORY_KEY_RE.test(storyKey) || !m || (date && !isDate(date))) return null;
    return { kind: "story_report", storyKey, date: date || null, message: m };
  }

  if (b.kind === "note") {
    const id = text(b.id);
    const m = message(b.message);
    if (!UUID_RE.test(id) || !m) return null;
    return { kind: "note", id, message: m };
  }

  return null;
}
