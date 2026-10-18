import "server-only";

import { randomBytes } from "crypto";

import type { Prefs } from "@/lib/personal";
import { adminRest } from "./admin-db";
import { sendMail } from "./mailer";

type Subscriber = {
  id: string;
  email: string;
  status: "pending" | "active" | "unsubscribed";
  token: string;
  confirm_sent_at: string | null;
  topics: string[];
  story_count: number;
  format: string;
  frequency: string;
};

export type ManagedSubscriber = Pick<Subscriber, "email" | "status"> & { prefs: Prefs };

const COLUMNS = "id,email,status,token,confirm_sent_at,topics,story_count,format,frequency";
// Don't send the same address another email from the sign-up form more often than this.
const RESEND_COOLDOWN_MS = 10 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

export function normaliseEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  return email.length <= 254 && EMAIL_RE.test(email) ? email : null;
}

function siteUrl(): string {
  return (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

function prefsColumns(prefs: Prefs) {
  return { topics: prefs.topics, story_count: prefs.count, format: prefs.format, frequency: prefs.frequency };
}

async function findBy(column: "email" | "token", value: string): Promise<Subscriber | null> {
  if (column === "token" && !TOKEN_RE.test(value)) return null;
  const rows = await adminRest<Subscriber[]>(
    `subscribers?select=${COLUMNS}&${column}=eq.${encodeURIComponent(value)}&limit=1`,
  );
  return rows[0] ?? null;
}

async function update(id: string, fields: Record<string, unknown>) {
  await adminRest(`subscribers?id=eq.${id}`, { method: "PATCH", body: fields, prefer: "return=minimal" });
}

/**
 * Start (or restart) a subscription. Always resolves the same way whatever the
 * address's state, so the form can't be used to find out who is subscribed.
 * `prefs` (from the builder) apply once the person confirms by email; an
 * already-active reader is instead emailed a link to change their settings.
 */
export async function subscribe(email: string, prefs?: Prefs): Promise<void> {
  const now = new Date();
  const existing = await findBy("email", email);

  if (existing) {
    const last = existing.confirm_sent_at ? Date.parse(existing.confirm_sent_at) : 0;
    if (now.getTime() - last < RESEND_COOLDOWN_MS) return;
    await update(existing.id, { confirm_sent_at: now.toISOString() });
    if (existing.status === "active") {
      await sendManageLink(email, existing.token);
      return;
    }
    if (prefs) await update(existing.id, prefsColumns(prefs));
    await sendConfirmation(email, existing.token);
    return;
  }

  const token = randomBytes(24).toString("base64url");
  await adminRest("subscribers", {
    method: "POST",
    body: { email, token, status: "pending", confirm_sent_at: now.toISOString(), ...(prefs ? prefsColumns(prefs) : {}) },
    prefer: "return=minimal",
  });
  await sendConfirmation(email, token);
}

export async function confirm(token: string): Promise<"confirmed" | "invalid"> {
  const sub = token ? await findBy("token", token) : null;
  if (!sub) return "invalid";
  if (sub.status !== "active") {
    await update(sub.id, { status: "active", confirmed_at: new Date().toISOString(), unsubscribed_at: null });
  }
  return "confirmed";
}

export async function unsubscribe(token: string): Promise<"unsubscribed" | "invalid"> {
  const sub = token ? await findBy("token", token) : null;
  if (!sub) return "invalid";
  if (sub.status !== "unsubscribed") {
    await update(sub.id, { status: "unsubscribed", unsubscribed_at: new Date().toISOString() });
  }
  return "unsubscribed";
}

/** For the preferences page reached from the link in every email. */
export async function getByToken(token: string): Promise<ManagedSubscriber | null> {
  const sub = await findBy("token", token);
  if (!sub) return null;
  return {
    email: sub.email,
    status: sub.status,
    prefs: { topics: sub.topics ?? [], count: sub.story_count ?? 10, format: sub.format ?? "summaries", frequency: sub.frequency ?? "daily" },
  };
}

export async function savePreferences(token: string, prefs: Prefs): Promise<boolean> {
  const sub = await findBy("token", token);
  if (!sub) return false;
  // Saving preferences from a link in your inbox also re-subscribes you.
  await update(sub.id, { ...prefsColumns(prefs), status: "active", unsubscribed_at: null });
  return true;
}

/**
 * A signed-in reader (verified email) gets an active subscription linked to
 * their account, created if needed. Returns their manage token.
 */
export async function ensureAccountSubscription(userId: string, email: string, prefs?: Prefs): Promise<string> {
  const existing = await findBy("email", email);
  if (existing) {
    await update(existing.id, { user_id: userId, ...(prefs ? { ...prefsColumns(prefs), status: "active", unsubscribed_at: null } : {}) });
    return existing.token;
  }
  const token = randomBytes(24).toString("base64url");
  await adminRest("subscribers", {
    method: "POST",
    body: {
      email,
      token,
      status: "active",
      confirmed_at: new Date().toISOString(),
      user_id: userId,
      ...prefsColumns(prefs ?? { topics: [], count: 10, format: "summaries", frequency: "daily" }),
    },
    prefer: "return=minimal",
  });
  return token;
}

export async function getAccountSubscription(email: string): Promise<(ManagedSubscriber & { token: string }) | null> {
  const sub = await findBy("email", email);
  if (!sub) return null;
  const managed = await getByToken(sub.token);
  return managed ? { ...managed, token: sub.token } : null;
}

function shell(body: string) {
  return `<!doctype html><html><body style="margin:0;background:#fbfaf7;font-family:-apple-system,'Segoe UI',Arial,sans-serif;color:#17150f;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
<tr><td style="font-size:20px;font-weight:800;"><span style="color:#c2410c;">&#9679;</span> ReadKernel</td></tr>
${body}
</table></td></tr></table></body></html>`;
}

function button(href: string, label: string) {
  return `<tr><td style="padding-top:24px;"><a href="${href}" style="display:inline-block;background:#17150f;color:#fbfaf7;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold;">${label}</a></td></tr>`;
}

async function sendConfirmation(email: string, token: string) {
  const link = `${siteUrl()}/confirm?token=${encodeURIComponent(token)}`;
  await sendMail({
    to: email,
    subject: "Confirm your ReadKernel subscription",
    text:
      `Hi! Please confirm you'd like the ReadKernel brief:\n\n${link}\n\n` +
      `If you didn't sign up, ignore this email and you won't hear from us again.`,
    html: shell(
      `<tr><td style="padding-top:20px;font-size:16px;line-height:1.5;">One click and the day's most important tech and AI stories arrive in your inbox.</td></tr>
${button(link, "Confirm subscription")}
<tr><td style="padding-top:24px;font-size:13px;color:#66625a;line-height:1.5;">If you didn't sign up, ignore this email and you won't hear from us again.</td></tr>`,
    ),
  });
}

async function sendManageLink(email: string, token: string) {
  const link = `${siteUrl()}/preferences?token=${encodeURIComponent(token)}`;
  await sendMail({
    to: email,
    subject: "Change your ReadKernel brief",
    text: `You're already subscribed. To change your topics, length, format or how often you hear from us:\n\n${link}\n`,
    html: shell(
      `<tr><td style="padding-top:20px;font-size:16px;line-height:1.5;">You're already subscribed. Use this link to change your topics, length, format or how often you hear from us.</td></tr>
${button(link, "Change my brief")}`,
    ),
  });
}
