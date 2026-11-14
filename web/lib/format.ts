export type Source = { name: string; title: string; url: string; published: string };

export type Story = {
  story_key?: string;
  brief_position?: number | null;
  headline: string;
  summary: string;
  why_it_matters: string;
  topic: string;
  score: number;
  importance: number | null;
  published: string;
  sources: Source[];
  kind?: "news" | "model_release";
  image_url?: string | null;
  image_credit?: string | null;
  thread_id?: string | null;
  companies?: string[];
};

export type CompanyTag = { slug: string; name: string };
export type CompanyLink = CompanyTag & { stories: number };

const COMPANY_SUFFIX_RE = /[\s,]+(inc|corp|corporation|co|ltd|limited|llc|plc|gmbh|ag|sa)\.?$/i;
const COMPANY_ALIASES: Record<string, string> = {
  "open-ai": "openai",
  "x-ai": "xai",
  "meta-platforms": "meta",
  alphabet: "google",
  "amazon-web-services": "aws",
};

export function companySlug(name: string): string {
  const s = name
    .trim()
    .replace(COMPANY_SUFFIX_RE, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return COMPANY_ALIASES[s] ?? s;
}

export const COMPANY_SLUG_RE = /^[a-z0-9-]{1,60}$/;

export type CompanyPost = {
  url: string;
  link: string;
  title: string;
  company: string;
  published: string;
  summary: string;
  category: string;
  depth: number | null;
  score: number;
  image_url: string | null;
  hn_points: number | null;
  found_via: "feed" | "hn";
  added_at?: string;
};

export const COMPANY_CATEGORIES: Record<string, string> = {
  ai: "AI & LLMs",
  ml: "Machine learning",
  data: "Data science & analytics",
  infra: "Infrastructure",
  apps: "Apps & product",
  security: "Security",
  engineering: "Engineering practice",
};

export type Discussion = {
  title: string;
  url: string;
  comments_url: string | null;
  source: string;
  points: number | null;
  comments: number | null;
  summary: string;
};

export type Edition = {
  date: string;
  generated_at: string;
  ai: string | null;
  stories: Story[];
  feed: Story[];
  discussions: Discussion[];
};

export type StoryWithDate = Story & { edition_date: string };

export type EditionSummary = { date: string; story_count: number; lead?: string };

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

export const TOPIC_BLURBS: Record<string, string> = {
  ai: "Models, labs and the companies building them",
  tech: "Big Tech, devices and platforms",
  dev: "Tools, open source and what developers are discussing",
  startups: "Funding, launches and founders, with an eye on India",
  security: "Breaches, vulnerabilities and fixes",
  markets: "Tech stocks, deals and the money behind tech",
  design: "Product and interface design",
};

export function faviconUrl(url: string): string {
  const host = domainOf(url);
  return host ? `https://www.google.com/s2/favicons?domain=${host}&sz=64` : "";
}

export function readingMinutes(stories: Story[]): number {
  const words = stories.reduce(
    (n, s) => n + `${s.headline} ${s.summary} ${s.why_it_matters}`.split(/\s+/).length,
    0,
  );
  return Math.max(1, Math.round(words / 220));
}
