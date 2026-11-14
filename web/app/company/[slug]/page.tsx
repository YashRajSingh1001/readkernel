import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Container } from "@/components/Container";
import { StoryCard } from "@/components/StoryCard";
import { companySlug, formatDate, getCompanyNews, getLatestEdition, listRecentCompanies } from "@/lib/brief";
import { listCompanyPosts } from "@/lib/companies";
import { siteUrl } from "@/lib/site";

export async function generateStaticParams() {
  const companies = await listRecentCompanies(30, 40);
  return companies.length ? companies.map((c) => ({ slug: c.slug })) : [{ slug: "placeholder" }];
}

export async function generateMetadata({ params }: PageProps<"/company/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const news = await getCompanyNews(slug);
  if (!news) return {};
  const title = `${news.name} news`;
  const description = `Every ${news.name} story ReadKernel has covered, with sources, and the companies it is most often in the news with.`;
  return { title, description, openGraph: { title, description, url: `${siteUrl()}/company/${slug}` } };
}

export default function CompanyPage({ params }: PageProps<"/company/[slug]">) {
  return (
    <Suspense fallback={<Container><p className="text-muted">Loading…</p></Container>}>
      <CompanyView params={params} />
    </Suspense>
  );
}

async function CompanyView({ params }: { params: PageProps<"/company/[slug]">["params"] }) {
  const { slug } = await params;
  const [news, posts, latest] = await Promise.all([getCompanyNews(slug), listCompanyPosts(), getLatestEdition()]);
  if (!news) notFound();

  const blog = posts.filter((p) => companySlug(p.company) === slug).slice(0, 3);
  const now = Date.parse(latest?.generated_at ?? news.stories[0].published);
  const oldest = news.stories.at(-1)?.edition_date;

  return (
    <Container>
      <p className="font-mono text-xs tracking-wide text-label uppercase">Company</p>
      <h1 className="mt-1 text-4xl font-extrabold tracking-tight">{news.name}</h1>
      <p className="mt-2 text-muted">
        {news.stories.length === 1 ? "1 story" : `${news.stories.length} stories`} in ReadKernel
        {oldest ? ` since ${formatDate(oldest)}` : ""}, newest first.
      </p>

      {news.often.length > 0 && (
        <section className="mt-8" aria-labelledby="often-with">
          <h2 id="often-with" className="text-sm font-semibold">
            Often in the news with
          </h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {news.often.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/company/${c.slug}`}
                  className="inline-block rounded-full border border-line bg-card px-3 py-1 text-sm hover:border-ink"
                >
                  {c.name} <span className="text-muted">· {c.stories}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-xl font-bold">Stories</h2>
        <div className="mt-1">
          {news.stories.map((s) => (
            <StoryCard key={`${s.story_key}-${s.edition_date}`} story={s} now={now} variant="compact" />
          ))}
        </div>
      </section>

      {blog.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-bold">From the {news.name} engineering blog</h2>
          <ul className="mt-3 divide-y divide-line">
            {blog.map((p) => (
              <li key={p.url} className="py-3">
                <a href={p.link} target="_blank" rel="noopener noreferrer" className="font-semibold hover:text-accent">
                  {p.title} ↗
                </a>
                <p className="mt-1 text-sm text-muted">{p.summary}</p>
              </li>
            ))}
          </ul>
          <Link href="/companies" className="mt-2 inline-block text-sm font-medium text-accent hover:underline">
            All company blogs →
          </Link>
        </section>
      )}
    </Container>
  );
}
