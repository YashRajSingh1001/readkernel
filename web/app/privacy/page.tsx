import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/Container";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What ReadKernel collects (very little), why, where it's stored, and how to delete it.",
};

const EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "readkernel.brief@gmail.com";

export default function PrivacyPage() {
  return (
    <Container>
      <p className="text-sm font-semibold text-label">Privacy</p>
      <h1 className="mt-1 text-4xl font-extrabold tracking-tight">Privacy, in plain words</h1>
      <p className="mt-2 text-xs text-muted">Last updated 18 October 2026</p>

      <div className="prose-rk mt-8">
        <p>
          ReadKernel collects as little as it can. You can read everything on the site without giving us anything. We
          don&apos;t run ads, we don&apos;t sell or share your data, and we don&apos;t put tracking pixels in our emails.
        </p>

        <h2>What we collect, and why</h2>
        <table>
          <thead>
            <tr>
              <th>What</th>
              <th>When</th>
              <th>Why</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Your email address</td>
              <td>You subscribe</td>
              <td>To send the brief you asked for</td>
            </tr>
            <tr>
              <td>Your brief settings (topics, length, format, daily or weekly)</td>
              <td>You build your brief</td>
              <td>To shape your email</td>
            </tr>
            <tr>
              <td>Which editions we sent you</td>
              <td>Each send</td>
              <td>So nobody gets the same email twice</td>
            </tr>
            <tr>
              <td>Your name and email from Google</td>
              <td>Only if you sign in</td>
              <td>To recognise you and link your brief and saved stories</td>
            </tr>
            <tr>
              <td>Saved stories</td>
              <td>You tap Save</td>
              <td>Kept in your browser; also in your account if you&apos;re signed in</td>
            </tr>
          </tbody>
        </table>

        <h2>Who helps us run ReadKernel</h2>
        <ul>
          <li>
            <strong>Supabase</strong> stores subscriber details and accounts.
          </li>
          <li>
            <strong>Vercel</strong> hosts the website.
          </li>
          <li>
            <strong>Our email provider</strong> (currently Gmail) delivers the brief.
          </li>
          <li>
            <strong>AI services</strong> write the story summaries and answer questions typed into Ask. For summaries
            they only ever see public news articles. For Ask they see the question and the news ReadKernel looks up to
            answer it, never your email or account.
          </li>
        </ul>
        <p>
          Story photos load from the publishers&apos; own websites, and small site icons load from Google&apos;s icon
          service, so those sites can see that your browser requested an image, as with any image on the web.
        </p>

        <h2>Your choices</h2>
        <ul>
          <li>
            <strong>Unsubscribe</strong> with one click from any email. We keep your address marked as unsubscribed so we
            never email you by mistake.
          </li>
          <li>
            <strong>Change your settings</strong> from the link in any email.
          </li>
          <li>
            <strong>Delete everything:</strong> email{" "}
            <a href={`mailto:${EMAIL}?subject=ReadKernel%3A%20delete%20my%20data`}>{EMAIL}</a> and we&apos;ll remove your
            details.
          </li>
        </ul>

        <h2>Questions</h2>
        <p>
          Ask us anything on the <Link href="/contact">contact page</Link>.
        </p>
      </div>
    </Container>
  );
}
