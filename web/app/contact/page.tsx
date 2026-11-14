import type { Metadata } from "next";
import Image from "next/image";

import { Container } from "@/components/Container";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with ReadKernel: feedback, corrections, source suggestions and image requests.",
};

const EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "readkernel.brief@gmail.com";

const REASONS = [
  { title: "Spotted a mistake?", body: "Send the story link and what's wrong. We fix errors and the rules that caused them.", subject: "Correction" },
  { title: "Suggest a source", body: "A site or blog we should read, or one we should drop. Tell us why.", subject: "Source suggestion" },
  { title: "Publishers", body: "Want a photo or a link removed, or your feed added? We act on every request.", subject: "Publisher request" },
  { title: "Anything else", body: "Feedback, ideas, partnerships. We read everything.", subject: "Hello" },
];

const MAKERS: { name: string; initials: string; role: string; linkedin: string; photo?: string }[] = [
  {
    name: "Yash Raj Singh",
    initials: "YS",
    role: "Co-creator",
    linkedin: "https://www.linkedin.com/in/yash-raj-singh-1001/",
    photo: "/team/yash-raj-singh.jpg",
  },
  { name: "Agamjyot Singh Chadha", initials: "AC", role: "Co-creator", linkedin: "https://www.linkedin.com/in/agamjyot-singh-chadha/" },
];

export default function ContactPage() {
  return (
    <Container>
      <p className="text-sm font-semibold text-label">Contact</p>
      <h1 className="mt-1 text-4xl font-extrabold tracking-tight">Get in touch</h1>
      <p className="mt-3 leading-relaxed text-muted">
        ReadKernel is a small, independent project. The fastest way to reach us is email:{" "}
        <a href={`mailto:${EMAIL}`} className="font-medium text-accent hover:underline">
          {EMAIL}
        </a>
        .
      </p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {REASONS.map((r) => (
          <li key={r.title}>
            <a
              href={`mailto:${EMAIL}?subject=${encodeURIComponent(`ReadKernel: ${r.subject}`)}`}
              className="block h-full rounded-xl border border-line bg-card p-5 hover:border-ink"
            >
              <h2 className="font-bold">{r.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">{r.body}</p>
              <span className="mt-3 inline-block text-sm font-medium text-accent">Email us →</span>
            </a>
          </li>
        ))}
      </ul>

      <section className="mt-14 border-t border-line pt-10" aria-labelledby="makers">
        <h2 id="makers" className="text-2xl font-bold tracking-tight">
          Who makes ReadKernel
        </h2>
        <p className="mt-2 leading-relaxed text-muted">
          Two people building it in the open. Your feedback goes straight to us, and we read all of it.
        </p>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {MAKERS.map((m) => (
            <li key={m.name} className="overflow-hidden rounded-xl border border-line bg-card">
              {m.photo ? (
                <Image
                  src={m.photo}
                  alt={m.name}
                  width={800}
                  height={1000}
                  sizes="(min-width: 640px) 360px, 100vw"
                  className="aspect-[4/5] w-full object-cover"
                />
              ) : (
                <div aria-hidden className="flex aspect-[4/5] w-full items-center justify-center bg-accent-soft text-6xl font-bold text-accent">
                  {m.initials}
                </div>
              )}
              <div className="p-5">
                <p className="font-bold">{m.name}</p>
                <p className="text-sm text-muted">{m.role}</p>
                <a
                  href={m.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-sm font-medium text-accent hover:underline"
                >
                  LinkedIn
                </a>
              </div>
            </li>
          ))}
        </ul>
        <figure className="mt-6 rounded-xl border border-line bg-card p-6 sm:p-8">
          <blockquote className="text-lg leading-relaxed text-pretty">
            &ldquo;I work with data all day, and keeping up with AI had quietly turned into a second job. Newsletters ran
            long, feeds were noisy, and the useful bits were often behind a paywall. So I built the brief I wanted to
            read: ten stories, a few lines each, and a link to every source. No ads, no fee, nothing to unlock.&rdquo;
          </blockquote>
          <figcaption className="mt-4 text-sm text-muted">Yash Raj Singh, on why ReadKernel exists</figcaption>
        </figure>
      </section>
    </Container>
  );
}
