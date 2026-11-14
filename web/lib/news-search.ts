export const MAX_SEARCH_ATTEMPTS = 6;

export const UNAVAILABLE = { unavailable: true } as const;

const UNAVAILABLE_NOTE =
  "Part of the archive could not be searched just now. Anything marked unavailable was not checked, so don't say it has nothing.";

export function broaderQueries(query: string): string[] {
  if (/["]|(^|\s)-\S/.test(query)) return [query];
  const words = query.split(/\s+/).filter(Boolean);
  const tries = [query];
  let kept = words.filter((w) => !/^[$€£₹]?[\d.,%]+[kmbt]?$/i.test(w));
  if (kept.length === 0) kept = words;
  for (let n = kept.length; n >= 1; n--) tries.push(kept.slice(0, n).join(" "));
  return [...new Set(tries)].slice(0, MAX_SEARCH_ATTEMPTS);
}

export function shouldCacheAnswer(result: { complete: boolean; degraded?: boolean }): boolean {
  return result.complete && !result.degraded;
}

type Search<T> = (query: string) => Promise<T[]>;

export async function searchArchive<S, P, SO, PO>(
  query: string,
  find: { stories: Search<S>; posts: Search<P> },
  show: { story: (s: S) => SO; post: (p: P) => PO },
) {
  for (const attempt of broaderQueries(query)) {
    const [stories, posts] = await Promise.allSettled([find.stories(attempt), find.posts(attempt)]);
    if (stories.status === "rejected") console.error("[search] story search failed", stories.reason);
    if (posts.status === "rejected") console.error("[search] company post search failed", posts.reason);
    if (stories.status === "rejected" && posts.status === "rejected") throw stories.reason;
    const failed = stories.status === "rejected" || posts.status === "rejected";
    const found = {
      stories: stories.status === "fulfilled" ? stories.value : null,
      posts: posts.status === "fulfilled" ? posts.value : null,
    };
    if (!failed && found.stories!.length === 0 && found.posts!.length === 0) continue;
    const notes = [
      ...(failed ? [UNAVAILABLE_NOTE] : []),
      ...(attempt !== query ? [`Nothing matched every word of "${query}"; these match "${attempt}".`] : []),
    ];
    return {
      query,
      ...(found.stories === null ? { stories: UNAVAILABLE } : {}),
      ...(found.posts === null ? { company_blog_posts: UNAVAILABLE } : {}),
      ...(attempt !== query ? { matched_query: attempt } : {}),
      ...(notes.length ? { note: notes.join(" ") } : {}),
      ...(found.stories !== null ? { stories: found.stories.map(show.story) } : {}),
      ...(found.posts !== null ? { company_blog_posts: found.posts.map(show.post) } : {}),
    };
  }
  return { query, stories: [] as SO[], company_blog_posts: [] as PO[] };
}
