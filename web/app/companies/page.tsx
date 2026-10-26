import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { CompanyPostCard } from "@/components/CompanyPostCard";
import { Container } from "@/components/Container";
import { COMPANIES, isWorthReading, listCompanyPosts } from "@/lib/companies";
import { COMPANY_CATEGORIES, faviconUrl } from "@/lib/format";

export const metadata: Metadata = {
  title: "Company blogs",
  description:
    "How real companies build: engineering and data science write-ups from Netflix, Uber, Airbnb, Meta and more, summarised and sorted by subject.",
};

type Filters = { category?: string; company?: string; sort: "new" | "best"; all: boolean };

function href(f: Filters, change: Partial<Filters>): string {
  const next = { ...f, ...change };
  const params = new URLSearchParams();
  if (next.category) params.set("category", next.category);
  if (next.company) params.set("company", next.company);
  if (next.sort === "best") params.set("sort", "best");
  if (next.all) params.set("all", "1");
  const query = params.toString();
  return query ? `/companies?${query}` : "/companies";
}

const chip = (on: boolean) =>
  `rounded-full border px-3 py-1 text-sm whitespace-nowrap ${
    on ? "border-ink bg-ink text-paper" : "border-line bg-card text-muted hover:border-ink hover:text-ink"
  }`;

export default function CompaniesPage({ searchParams }: PageProps<"/companies">) {
  return (
    <Container size="wide">
      <header className="max-w-3xl">
        <p className="font-mono text-xs tracking-wide text-label uppercase">Company blogs</p>
        <h1 className="mt-1 text-4xl font-extrabold tracking-tight">How real companies build</h1>
        <p className="mt-2 text-muted">
          Engineering and data science write-ups straight from the teams at {COMPANIES.length} companies. Each one
          summarised in a line or two and sorted by subject. New posts are added every morning.
        </p>
      </header>

      <section aria-label="Companies we read" className="mt-6 rounded-2xl border border-line bg-sunk px-4 py-5">
        <p className="text-center font-mono text-xs tracking-wide text-muted uppercase">Reading the blogs of</p>
        <ul className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-3">
          {COMPANIES.map((c) => (
            <li key={c.name}>
              <Link
                href={`/companies?company=${encodeURIComponent(c.name)}`}
                className="flex items-center gap-2 text-sm font-medium hover:text-accent"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- favicons come from Google's favicon service */}
                <img src={faviconUrl(c.site)} alt="" width={16} height={16} loading="lazy" referrerPolicy="no-referrer" className="h-4 w-4 rounded" />
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <Suspense fallback={<p className="mt-8 text-muted">Loading posts…</p>}>
        <Posts searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}

async function Posts({ searchParams }: { searchParams: PageProps<"/companies">["searchParams"] }) {
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const all = await listCompanyPosts();
  const companyNames = [...new Set(all.map((p) => p.company))];

  const category = one(params.category);
  const company = one(params.company);
  const f: Filters = {
    category: category && COMPANY_CATEGORIES[category] ? category : undefined,
    company: company && companyNames.includes(company) ? company : undefined,
    sort: one(params.sort) === "best" ? "best" : "new",
    all: one(params.all) === "1",
  };

  const readable = f.all ? all : all.filter(isWorthReading);
  const byCompany = f.company ? readable.filter((p) => p.company === f.company) : readable;
  const shown = (f.category ? byCompany.filter((p) => p.category === f.category) : [...byCompany]).sort((a, b) =>
    f.sort === "best" ? b.score - a.score : Date.parse(b.published) - Date.parse(a.published),
  );
  const hidden = all.length - all.filter(isWorthReading).length;

  const categoryCounts: Record<string, number> = {};
  for (const p of byCompany) categoryCounts[p.category] = (categoryCounts[p.category] ?? 0) + 1;
  const companyCounts = new Map<string, number>();
  for (const p of readable) companyCounts.set(p.company, (companyCounts.get(p.company) ?? 0) + 1);
  const companies = [...companyCounts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  if (all.length === 0) {
    return (
      <p className="mt-8 rounded-xl border border-dashed border-line p-8 text-center text-muted">
        No posts yet. They arrive with the next morning run.
      </p>
    );
  }

  return (
    <>
      <nav aria-label="Subjects" className="mt-8 flex gap-2 overflow-x-auto pb-1">
        <Link href={href(f, { category: undefined })} className={chip(!f.category)}>
          All <span className="opacity-60">{byCompany.length}</span>
        </Link>
        {Object.entries(COMPANY_CATEGORIES)
          .filter(([id]) => categoryCounts[id])
          .map(([id, label]) => (
            <Link key={id} href={href(f, { category: id })} className={chip(f.category === id)}>
              {label} <span className="opacity-60">{categoryCounts[id]}</span>
            </Link>
          ))}
      </nav>

      <div className="mt-8 flex flex-col gap-10 lg:flex-row-reverse">
        <aside className="lg:w-56 lg:shrink-0">
          <p className="mb-2 font-mono text-[11px] tracking-wide text-muted uppercase">Companies</p>
          <ul className="flex flex-wrap gap-1.5 lg:flex-col lg:gap-0">
            {f.company && (
              <li>
                <Link href={href(f, { company: undefined })} className="block rounded-lg px-2 py-1 text-sm text-accent hover:underline">
                  ← All companies
                </Link>
              </li>
            )}
            {companies.map(([name, count]) => (
              <li key={name}>
                <Link
                  href={href(f, { company: name })}
                  aria-current={f.company === name ? "page" : undefined}
                  className={`flex justify-between gap-3 rounded-lg px-2 py-1 text-sm ${
                    f.company === name ? "bg-ink font-semibold text-paper" : "text-muted hover:bg-sunk hover:text-ink"
                  }`}
                >
                  {name}
                  <span className="font-mono text-xs opacity-70 tabular-nums">{count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-4 border-b border-line pb-3 text-sm">
            <p className="text-muted">
              {shown.length} {shown.length === 1 ? "post" : "posts"}
              {f.company ? ` from ${f.company}` : ""}
              {f.category ? ` on ${COMPANY_CATEGORIES[f.category]}` : ""}
            </p>
            <p className="flex gap-3">
              <Link href={href(f, { sort: "new" })} className={f.sort === "new" ? "font-semibold" : "text-muted hover:text-ink"}>
                Newest
              </Link>
              <Link href={href(f, { sort: "best" })} className={f.sort === "best" ? "font-semibold" : "text-muted hover:text-ink"}>
                Best
              </Link>
            </p>
          </div>
          {shown.length === 0 ? (
            <p className="py-10 text-center text-muted">Nothing here yet. Try another subject or company.</p>
          ) : (
            shown.map((p) => <CompanyPostCard key={p.url} post={p} />)
          )}
          {hidden > 0 && (
            <p className="mt-6 text-center text-sm text-muted">
              {f.all ? (
                <Link href={href(f, { all: false })} className="text-accent hover:underline">
                  Hide product announcements and marketing posts
                </Link>
              ) : (
                <>
                  {hidden} product announcements and marketing posts are hidden.{" "}
                  <Link href={href(f, { all: true })} className="text-accent hover:underline">
                    Show them
                  </Link>
                </>
              )}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
