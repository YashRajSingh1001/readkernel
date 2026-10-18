import type { Metadata } from "next";

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

export default function ContactPage() {
  return (
    <Container>
      <p className="font-mono text-xs tracking-wide text-label uppercase">Contact</p>
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
    </Container>
  );
}
