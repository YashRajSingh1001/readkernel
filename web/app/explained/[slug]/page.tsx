import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Container } from "@/components/Container";
import { domainOf, formatDate } from "@/lib/brief";
import { getExplainer, listExplainers } from "@/lib/explained";
import { siteUrl } from "@/lib/site";

export async function generateStaticParams() {
  const explainers = await listExplainers();
  return explainers.length ? explainers.map((e) => ({ slug: e.slug })) : [{ slug: "placeholder" }];
}

export async function generateMetadata({ params }: PageProps<"/explained/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const explainer = await getExplainer(slug);
  if (!explainer) return {};
  const description = explainer.body.what_it_is;
  return {
    title: explainer.title,
    description,
    openGraph: { title: explainer.title, description, type: "article", url: `${siteUrl()}/explained/${slug}` },
  };
}

export default function ExplainerPage({ params }: PageProps<"/explained/[slug]">) {
  return (
    <Suspense fallback={<Container><p className="text-muted">Loading…</p></Container>}>
      <ExplainerView params={params} />
    </Suspense>
  );
}

async function ExplainerView({ params }: { params: PageProps<"/explained/[slug]">["params"] }) {
  const { slug } = await params;
  const explainer = await getExplainer(slug);
  if (!explainer) notFound();
  const { body } = explainer;

  return (
    <Container>
      <article>
        <Link href="/explained" className="mb-6 inline-block text-sm text-muted hover:text-ink">
          ← Explained
        </Link>
        <p className="text-sm font-semibold text-label">Explained · week of {formatDate(explainer.week_of)}</p>
        <h1 className="mt-1 text-3xl leading-tight font-extrabold tracking-tight text-balance sm:text-4xl">
          {explainer.title}
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-pretty">{body.what_it_is}</p>

        <section className="mt-8">
          <h2 className="text-xl font-bold">How it works</h2>
          <ol className="mt-4 space-y-5">
            {body.steps.map((step, i) => (
              <li key={i} className="flex gap-4">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-bold text-accent">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="leading-relaxed">{step.text}</p>
                  <blockquote className="mt-2 border-l-2 border-line pl-3 text-sm leading-relaxed text-muted">
                    “{step.quote}”
                    <span className="mt-1 block text-xs">{explainer.source_name}</span>
                  </blockquote>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-bold">What’s new</h2>
          <p className="mt-2 leading-relaxed">{body.whats_new}</p>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-bold">Limits</h2>
          <p className="mt-2 leading-relaxed">{body.limits}</p>
        </section>

        <section className="mt-8 rounded-xl border border-line bg-card px-4 py-4">
          <h2 className="text-xl font-bold">Try it</h2>
          <p className="mt-2 leading-relaxed">{body.try_it}</p>
        </section>

        <footer className="mt-8 border-t border-line pt-4 text-sm text-muted">
          <p>
            Source:{" "}
            <a href={explainer.source_url} target="_blank" rel="noopener noreferrer" className="text-ink hover:text-accent">
              {explainer.source_name} ({domainOf(explainer.source_url)}) ↗
            </a>
          </p>
          <p className="mt-1">
            <Link href={`/story/${explainer.story_key}`} className="hover:text-accent">
              Read the news story
            </Link>
          </p>
          <p className="mt-3">Drafted by AI from the source, checked by a person before publishing.</p>
        </footer>
      </article>
    </Container>
  );
}
