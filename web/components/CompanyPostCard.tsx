import Link from "next/link";

import { COMPANY_CATEGORIES, faviconUrl, formatDate, type CompanyPost } from "@/lib/format";
import { StoryImage } from "./StoryImage";

type Props = { post: CompanyPost; variant?: "standard" | "compact" };

/** One company blog post. The title opens the company's own post. */
export function CompanyPostCard({ post, variant = "standard" }: Props) {
  const category = COMPANY_CATEGORIES[post.category] ?? post.category;

  const meta = (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem] text-muted">
      <Link href={`/companies?company=${encodeURIComponent(post.company)}`} className="flex items-center gap-1.5 font-medium text-ink hover:text-accent">
        {/* eslint-disable-next-line @next/next/no-img-element -- favicons come from Google's favicon service */}
        <img src={faviconUrl(post.link)} alt="" width={16} height={16} loading="lazy" referrerPolicy="no-referrer" className="h-4 w-4 rounded" />
        {post.company}
      </Link>
      <Link href={`/companies?category=${post.category}`} className="font-semibold text-accent hover:underline">
        {category}
      </Link>
      {post.depth != null && post.depth >= 4 && (
        <span className="font-semibold text-label">Deep dive</span>
      )}
      <span>{formatDate(post.published.slice(0, 10), "short")}</span>
      {post.hn_points != null && post.hn_points >= 20 && <span className="text-accent">▲ {post.hn_points} on HN</span>}
    </div>
  );

  const title = (
    <h3 className={`font-serif leading-snug font-semibold text-balance ${variant === "compact" ? "text-base" : "text-xl"}`}>
      <a href={post.link} target="_blank" rel="noopener noreferrer" className="rk-headline">
        {post.title}
      </a>
    </h3>
  );

  if (variant === "compact") {
    return (
      <article className="flex gap-3 border-b border-line py-4 last:border-b-0">
        <div className="w-20 shrink-0 sm:w-24">
          <StoryImage src={post.image_url} topic={post.category} label={category} headline={post.title} size="thumb" />
        </div>
        <div className="min-w-0 flex-1">
          {meta}
          <div className="mt-1">{title}</div>
          {post.summary && <p className="mt-1 line-clamp-2 text-sm text-muted">{post.summary}</p>}
        </div>
      </article>
    );
  }

  return (
    <article className="grid gap-4 border-b border-line py-6 last:border-b-0 sm:grid-cols-[1fr_180px]">
      <div className="min-w-0">
        {meta}
        <div className="mt-2">{title}</div>
        {post.summary && <p className="mt-2 leading-relaxed text-pretty">{post.summary}</p>}
      </div>
      <StoryImage
        src={post.image_url}
        credit={post.company}
        topic={post.category}
        label={category}
        headline={post.title}
        sourceName={post.company}
        sourceUrl={post.link}
      />
    </article>
  );
}
