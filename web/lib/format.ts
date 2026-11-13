// Types and helpers shared by server pages and client components (no Node APIs here).

export type Source = { name: string; title: string; url: string; published: string };

export type Story = {
  story_key?: string; // stable id for /story/<key>
  brief_position?: number | null; // 1-10 if in the daily brief
  headline: string;
  summary: string;
  why_it_matters: string;
  topic: string;
  score: number;
  importance: number | null;
  published: string;
  sources: Source[];
  kind?: "news" | "model_release";
  image_url?: string | null; // the publisher's own preview photo
  image_credit?: string | null;
  thread_id?: string | null; // same id = same ongoing story across days
  companies?: string[]; // local files only; the database keeps them in story_companies
};

/** A company a story is about, and how many stories it shares with another. */
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

/** Same as the pipeline's companies.slug(): "OpenAI Inc." -> "openai". Keep the two in step. */
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

/** An engineering or data science post from a company blog (see /companies). */
export type CompanyPost = {
  url: string; // cleaned-up address, unique
  link: string; // the address readers open
  title: string;
  company: string;
  published: string;
  summary: string;
  category: string;
  depth: number | null; // 1 = announcement ... 5 = deep technical write-up
  score: number;
  image_url: string | null;
  hn_points: number | null;
  found_via: "feed" | "hn";
  added_at?: string;
};

// Same ids as pipeline/kernel/company_blogs.py CATEGORIES.
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
  stories: Story[]; // the daily brief, in brief order
  feed: Story[]; // every story saved that day, best first
  discussions: Discussion[]; // Top articles
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

export function formatDate(date: string, style: "long" | "short" | "full" = "long"): string {
  const d = new Date(`${date}T00:00:00Z`);
  return d.toLocaleDateString("en-GB", {
    timeZone: "UTC",
    weekday: style === "short" ? undefined : "long",
    day: "numeric",
    month: style === "short" ? "short" : "long",
    year: style === "long" ? undefined : "numeric",
  });
}

/** "6:12 am IST": when an edition was published, in the brief's home time zone. */
export function formatTimeIST(iso: string): string {
  const time = new Date(iso).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" });
  return `${time} IST`;
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

/** Small site icon for a source link (Google's public icon service). */
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
