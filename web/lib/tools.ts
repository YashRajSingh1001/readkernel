import "server-only";

// ReadKernel's news, as tools an AI agent can call. One definition serves
// the MCP server (/mcp, for Claude, Cursor and other assistants) and the
// Ask ReadKernel chat (/ask). Everything here is read-only public data.

import {
  TOPICS,
  companySlug,
  getCompanyNews,
  getEdition,
  getLatestEdition,
  getStory,
  getStoryCompanies,
  getThread,
  isValidDate,
  searchStories,
  type Story,
} from "./brief";
import { highlights, isWorthReading, listCompanyPosts, searchCompanyPosts } from "./companies";
import { COMPANY_CATEGORIES, type CompanyPost } from "./format";
import { siteUrl } from "./site";

type JsonSchema = { type: "object"; properties: Record<string, unknown>; required?: string[]; additionalProperties: false };

export type NewsTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: JsonSchema;
  run: (args: Record<string, unknown>) => Promise<unknown>;
};

/** Bad input from the model or a client; shown back to it so it can retry. */
export class ToolInputError extends Error {}

const TOPIC_IDS = Object.keys(TOPICS);
const CATEGORY_IDS = Object.keys(COMPANY_CATEGORIES);

function text(args: Record<string, unknown>, key: string, max = 200): string | undefined {
  const value = args[key];
  if (value == null || value === "") return undefined;
  if (typeof value !== "string") throw new ToolInputError(`${key} must be text`);
  return value.trim().slice(0, max);
}

function oneOf(args: Record<string, unknown>, key: string, allowed: string[]): string | undefined {
  const value = text(args, key);
  if (value && !allowed.includes(value)) throw new ToolInputError(`${key} must be one of: ${allowed.join(", ")}`);
  return value;
}

function count(args: Record<string, unknown>, key: string, fallback: number, max: number): number {
  const n = Number(args[key] ?? fallback);
  return Number.isFinite(n) ? Math.min(Math.max(1, Math.round(n)), max) : fallback;
}

const MAX_SEARCH_ATTEMPTS = 6;

/**
 * The query, then broader versions to try if it finds nothing: years and
 * bare numbers removed (not names with digits, like GPT-6.1 or Arete-27B),
 * then one word fewer from the end each time. Queries using "phrases" or
 * -exclusions are taken as written.
 */
export function broaderQueries(query: string): string[] {
  if (/["]|(^|\s)-\S/.test(query)) return [query];
  const words = query.split(/\s+/).filter(Boolean);
  const tries = [query];
  let kept = words.filter((w) => !/^[$€£₹]?[\d.,%]+[kmbt]?$/i.test(w));
  if (kept.length === 0) kept = words;
  for (let n = kept.length; n >= 1; n--) tries.push(kept.slice(0, n).join(" "));
  return [...new Set(tries)].slice(0, MAX_SEARCH_ATTEMPTS);
}

// Compact shapes: what an agent needs, with a link for every claim.
function story(s: Story & { edition_date?: string }, rank?: number) {
  return {
    ...(rank ? { rank } : {}),
    ...(s.edition_date ? { date: s.edition_date } : {}),
    story_key: s.story_key,
    headline: s.headline,
    summary: s.summary,
    why_it_matters: s.why_it_matters || undefined,
    topic: TOPICS[s.topic] ?? s.topic,
    kind: s.kind === "model_release" ? "model release" : undefined,
    published: s.published,
    readkernel_url: s.story_key ? `${siteUrl()}/story/${s.story_key}` : undefined,
    sources: s.sources.slice(0, 6).map((x) => ({ name: x.name, url: x.url })),
    // Ready-made markdown citation, so answers can link the source exactly.
    cite: s.sources[0] ? `[${s.sources[0].name}](${s.sources[0].url})` : undefined,
  };
}

function companyPost(p: CompanyPost) {
  return {
    company: p.company,
    title: p.title,
    summary: p.summary,
    subject: COMPANY_CATEGORIES[p.category] ?? p.category,
    published: p.published.slice(0, 10),
    deep_dive: (p.depth ?? 0) >= 4 || undefined,
    url: p.link,
    cite: `[${p.company}](${p.link})`,
  };
}

export const NEWS_TOOLS: NewsTool[] = [
  {
    name: "get_today_news",
    title: "Today's tech and AI news",
    description:
      "Today's ReadKernel brief: the 10 most important tech and AI stories, ranked, each with a summary, why it " +
      "matters and links to every source. Use scope 'feed' for all ~30 stories of the day, and topic to narrow it.",
    inputSchema: {
      type: "object",
      properties: {
        topic: { type: "string", enum: TOPIC_IDS, description: "Only this topic" },
        scope: { type: "string", enum: ["brief", "feed"], description: "'brief' = top 10 (default), 'feed' = all of today's stories" },
      },
      additionalProperties: false,
    },
    async run(args) {
      const topic = oneOf(args, "topic", TOPIC_IDS);
      const scope = oneOf(args, "scope", ["brief", "feed"]) ?? "brief";
      const edition = await getLatestEdition();
      if (!edition) return { message: "No brief has been published yet." };
      const list = scope === "feed" ? edition.feed : edition.stories;
      const chosen = topic ? list.filter((s) => s.topic === topic) : list;
      return { date: edition.date, stories: chosen.map((s, i) => story(s, scope === "brief" && !topic ? i + 1 : undefined)) };
    },
  },
  {
    name: "get_brief_by_date",
    title: "A past day's brief",
    description: "The ReadKernel brief for one past day (YYYY-MM-DD): its top 10 stories with summaries and sources.",
    inputSchema: {
      type: "object",
      properties: { date: { type: "string", description: "Day in YYYY-MM-DD format" } },
      required: ["date"],
      additionalProperties: false,
    },
    async run(args) {
      const date = text(args, "date", 10) ?? "";
      if (!isValidDate(date)) throw new ToolInputError("date must look like 2026-10-25");
      const edition = await getEdition(date);
      if (!edition) return { message: `No brief for ${date}. Briefs exist from October 2026 onwards.` };
      return { date, stories: edition.stories.map((s, i) => story(s, i + 1)) };
    },
  },
  {
    name: "search_news",
    title: "Search the news archive",
    description:
      "Search every story ReadKernel has covered, plus company engineering blog posts. Plain words, \"exact " +
      "phrases\" and -excluded words work. Every word must match, so use 1-3 keywords (a company, product or " +
      "person), not sentences. Newest first.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Keywords, e.g. Nvidia, \"open weights\", UPI" },
        limit: { type: "integer", minimum: 1, maximum: 20, description: "How many stories (default 10)" },
      },
      required: ["query"],
      additionalProperties: false,
    },
    async run(args) {
      const query = text(args, "query", 100);
      if (!query || query.length < 2) throw new ToolInputError("query needs at least 2 characters");
      const limit = count(args, "limit", 10, 20);
      // Every word must match, so one stray word ("2026", "competitors") can
      // empty the results. If it does, retry with fewer words and say so.
      for (const attempt of broaderQueries(query)) {
        const [stories, posts] = await Promise.all([searchStories(attempt, limit), searchCompanyPosts(attempt, 5)]);
        if (stories.length === 0 && posts.length === 0) continue;
        return {
          query,
          ...(attempt !== query ? { note: `Nothing matched every word of "${query}"; these match "${attempt}".` } : {}),
          stories: stories.slice(0, limit).map((s) => story(s)),
          company_blog_posts: posts.map(companyPost),
        };
      }
      return { query, stories: [], company_blog_posts: [] };
    },
  },
  {
    name: "get_story",
    title: "One story and its timeline",
    description:
      "One story by its story_key (from another tool), with all its sources and its timeline: how the same " +
      "ongoing story was covered on earlier days.",
    inputSchema: {
      type: "object",
      properties: { story_key: { type: "string", description: "The story_key from get_today_news or search_news" } },
      required: ["story_key"],
      additionalProperties: false,
    },
    async run(args) {
      const key = text(args, "story_key", 40) ?? "";
      const found = await getStory(key);
      if (!found) return { message: `No story with key ${key}.` };
      const [timeline, companies] = await Promise.all([
        getThread(found.thread_id || key),
        getStoryCompanies(key, found.edition_date),
      ]);
      return {
        story: { ...story(found), companies: companies.length ? companies.map((c) => c.name) : undefined },
        timeline: timeline
          .filter((t) => t.edition_date !== found.edition_date)
          .map((t) => ({ date: t.edition_date, headline: t.headline, summary: t.summary, story_key: t.story_key })),
      };
    },
  },
  {
    name: "get_company_news",
    title: "News about one company",
    description:
      "Every story ReadKernel has covered about one company, newest first, plus the companies that appear in " +
      "the same stories most often (rivals, partners or deal counterparts; read the stories to tell which). " +
      "Use the company's name, e.g. OpenAI or Nvidia.",
    inputSchema: {
      type: "object",
      properties: {
        company: { type: "string", description: "Company name, e.g. OpenAI" },
        limit: { type: "integer", minimum: 1, maximum: 20, description: "How many stories (default 8)" },
      },
      required: ["company"],
      additionalProperties: false,
    },
    async run(args) {
      const name = text(args, "company", 60);
      if (!name || name.length < 2) throw new ToolInputError("company needs at least 2 characters");
      const limit = count(args, "limit", 8, 20);
      const news = await getCompanyNews(companySlug(name));
      if (!news) return { company: name, stories: [], note: `No stories are tagged with ${name}. Try search_news.` };
      return {
        company: news.name,
        page: `${siteUrl()}/company/${news.slug}`,
        stories: news.stories.slice(0, limit).map((s) => story(s)),
        often_in_the_news_with: news.often.map((c) => ({ company: c.name, shared_stories: c.stories })),
      };
    },
  },
  {
    name: "get_top_articles",
    title: "What developers are discussing",
    description: "Today's most-upvoted posts on Hacker News, with points, comment counts and a one-line summary.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    async run() {
      const edition = await getLatestEdition();
      return {
        date: edition?.date,
        articles: (edition?.discussions ?? []).map((d) => ({
          title: d.title,
          summary: d.summary,
          points: d.points,
          comments: d.comments,
          url: d.url,
          discussion: d.comments_url,
        })),
      };
    },
  },
  {
    name: "get_company_posts",
    title: "Company engineering blogs",
    description:
      "Recent engineering and data science write-ups from company blogs (Netflix, Uber, Meta, Airbnb, Stripe and " +
      "about 25 more), each summarised. Filter by company name or subject.",
    inputSchema: {
      type: "object",
      properties: {
        company: { type: "string", description: "Company name, e.g. Netflix" },
        subject: { type: "string", enum: CATEGORY_IDS, description: "Subject: " + CATEGORY_IDS.join(", ") },
        best: { type: "boolean", description: "Best of the last week instead of newest" },
        limit: { type: "integer", minimum: 1, maximum: 20, description: "How many (default 8)" },
      },
      additionalProperties: false,
    },
    async run(args) {
      const company = text(args, "company", 60)?.toLowerCase();
      const subject = oneOf(args, "subject", CATEGORY_IDS);
      const limit = count(args, "limit", 8, 20);
      let posts = (await listCompanyPosts()).filter(isWorthReading);
      if (company) posts = posts.filter((p) => p.company.toLowerCase() === company);
      if (subject) posts = posts.filter((p) => p.category === subject);
      if (args.best === true) posts = highlights(posts, limit, 7);
      if (posts.length === 0 && (company || subject)) {
        return { posts: [], note: "Nothing matches these filters. Try without subject, or use search_news." };
      }
      return { posts: posts.slice(0, limit).map(companyPost) };
    },
  },
];

export const TOOLS_BY_NAME = new Map(NEWS_TOOLS.map((t) => [t.name, t]));

/** Run one tool by name; errors come back as data the caller can show. */
export async function runTool(name: string, args: unknown): Promise<{ ok: true; result: unknown } | { ok: false; error: string }> {
  const tool = TOOLS_BY_NAME.get(name);
  if (!tool) return { ok: false, error: `Unknown tool ${name}` };
  try {
    const input = args && typeof args === "object" && !Array.isArray(args) ? (args as Record<string, unknown>) : {};
    return { ok: true, result: await tool.run(input) };
  } catch (err) {
    if (err instanceof ToolInputError) return { ok: false, error: err.message };
    console.error(`[tools] ${name}`, err);
    return { ok: false, error: "The news database could not be reached. Try again shortly." };
  }
}
