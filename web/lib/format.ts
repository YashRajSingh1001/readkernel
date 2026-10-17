// Types and helpers shared by server pages and client components (no Node APIs here).

export type Source = { name: string; title: string; url: string; published: string };

export type Story = {
  headline: string;
  summary: string;
  why_it_matters: string;
  topic: string;
  score: number;
  importance: number | null;
  published: string;
  sources: Source[];
};

export type Edition = {
  date: string;
  generated_at: string;
  ai: string | null;
  stories: Story[];
};

export type EditionSummary = { date: string; story_count: number };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const TOPICS: Record<string, string> = {
  ai: "AI",
  tech: "Tech",
  dev: "Developers",
  startups: "Startups",
  security: "Security",
  markets: "Markets",
  design: "Design",
};

export function isValidDate(value: string): boolean {
  return DATE_RE.test(value) && !Number.isNaN(Date.parse(value));
}

export function formatDate(date: string, style: "long" | "short" = "long"): string {
  const d = new Date(`${date}T00:00:00Z`);
  return d.toLocaleDateString("en-GB", {
    timeZone: "UTC",
    weekday: style === "long" ? "long" : undefined,
    day: "numeric",
    month: style === "long" ? "long" : "short",
    year: style === "short" ? "numeric" : undefined,
  });
}

export function timeAgo(iso: string, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
