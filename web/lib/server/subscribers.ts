import "server-only";

import { randomBytes } from "crypto";
import { headers } from "next/headers";

import type { Story } from "@/lib/format";
import { DEFAULT_PREFS, selectStories, type Prefs } from "@/lib/personal";
import { adminRest } from "./admin-db";
import { renderBrief } from "./brief-email";
import { isPreviewTransport, sendMail } from "./mailer";

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
  company_read: boolean;
};

export type ManagedSubscriber = Pick<Subscriber, "email" | "status"> & { prefs: Prefs };

const COLUMNS = "id,email,status,token,confirm_sent_at,topics,story_count,format,frequency,company_read";
const RESEND_COOLDOWN_MS = 10 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

export function normaliseEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  return email.length <= 254 && EMAIL_RE.test(email) ? email : null;
}

const LOCAL_RE = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

async function siteUrl(): Promise<string> {
  const configured = (process.env.SITE_URL || "").replace(/\/$/, "");
  if (configured && !LOCAL_RE.test(configured)) return configured;
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
    if (host && !/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)) {
      return `${h.get("x-forwarded-proto") ?? "https"}://${host}`;
    }
  } catch {
  }
  return configured || "http://localhost:3000";
}

function prefsColumns(prefs: Prefs) {
  return {
    topics: prefs.topics,
    story_count: prefs.count,
    format: prefs.format,
    frequency: prefs.frequency,
    company_read: prefs.companyRead,
  };
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

export type ConfirmResult = { status: "confirmed"; briefSent: boolean } | { status: "invalid" };

export async function confirm(token: string): Promise<ConfirmResult> {
  const sub = token ? await findBy("token", token) : null;
  if (!sub) return { status: "invalid" };
  if (sub.status !== "active") {
    await update(sub.id, { status: "active", confirmed_at: new Date().toISOString(), unsubscribed_at: null });
  }
  let briefSent = false;
  try {
    briefSent = await sendTodaysBrief(sub);
  } catch (err) {
    console.error("[confirm] today's brief", err);
  }
  return { status: "confirmed", briefSent };
}

const STORY_COLUMNS =
  "story_key,brief_position,position,headline,summary,why_it_matters,topic,kind," +
  "score,importance,published,image_url,image_credit,thread_id,sources";

function today(): string {
  const timeZone = process.env.TIMEZONE || "Asia/Kolkata";
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

async function sendTodaysBrief(sub: Subscriber): Promise<boolean> {
  if ((sub.frequency ?? "daily") !== "daily") return false;
  const day = today();
  const rows = await adminRest<{ date: string; stories: Story[] }[]>(
    `editions?select=date,stories(${STORY_COLUMNS})&stories.order=position.asc&date=eq.${day}`,
  );
  if (!rows[0]) return false;
  const feed = rows[0].stories;
  const brief = feed
    .filter((s) => s.brief_position != null)
    .sort((a, b) => (a.brief_position ?? 0) - (b.brief_position ?? 0));
  if (brief.length === 0) return false;
  const stories = selectStories(brief, feed, sub.topics ?? [], sub.story_count ?? 10);
  if (stories.length === 0) return false;

  const email = renderBrief({ date: day, stories }, await siteUrl(), sub.token, sub.format);
  if (isPreviewTransport()) {
    await sendMail({ to: sub.email, ...email });
    return false;
  }

  const claimed = await adminRest<unknown[]>("email_sends?on_conflict=edition_date,subscriber_id,kind", {
    method: "POST",
    body: { edition_date: day, subscriber_id: sub.id, kind: "daily" },
    prefer: "resolution=ignore-duplicates,return=representation",
  });
  if (!claimed?.length) return false;
  try {
    await sendMail({ to: sub.email, ...email });
  } catch (err) {
    await adminRest(
      `email_sends?edition_date=eq.${day}&subscriber_id=eq.${sub.id}&kind=eq.daily`,
      { method: "DELETE", prefer: "return=minimal" },
    ).catch(() => {});
    throw err;
  }
  return true;
}

export async function unsubscribe(token: string): Promise<"unsubscribed" | "invalid"> {
  const sub = token ? await findBy("token", token) : null;
  if (!sub) return "invalid";
  if (sub.status !== "unsubscribed") {
    await update(sub.id, { status: "unsubscribed", unsubscribed_at: new Date().toISOString() });
  }
  return "unsubscribed";
}

export async function getByToken(token: string): Promise<ManagedSubscriber | null> {
  const sub = await findBy("token", token);
  if (!sub) return null;
  return {
    email: sub.email,
    status: sub.status,
    prefs: {
      topics: sub.topics ?? [],
      count: sub.story_count ?? 10,
      format: sub.format ?? "summaries",
      frequency: sub.frequency ?? "daily",
      companyRead: sub.company_read ?? true,
    },
  };
}

export async function savePreferences(token: string, prefs: Prefs): Promise<boolean> {
  const sub = await findBy("token", token);
  if (!sub) return false;
  await update(sub.id, { ...prefsColumns(prefs), status: "active", unsubscribed_at: null });
  return true;
}

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
      ...prefsColumns(prefs ?? DEFAULT_PREFS),
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
<tr><td style="font-size:22px;font-family:'Century Gothic',CenturyGothic,'Trebuchet MS',Arial,sans-serif;">read<strong>kernel</strong><span style="color:#c2410c;">.</span></td></tr>
${body}
</table></td></tr></table></body></html>`;
}

function button(href: string, label: string) {
  return `<tr><td style="padding-top:24px;"><a href="${href}" style="display:inline-block;background:#17150f;color:#fbfaf7;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold;">${label}</a></td></tr>`;
}

async function sendConfirmation(email: string, token: string) {
  const link = `${await siteUrl()}/confirm?token=${encodeURIComponent(token)}`;
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
  const link = `${await siteUrl()}/preferences?token=${encodeURIComponent(token)}`;
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

export const MAX_WATCHES = 3;
export type Watch = { id: string; description: string };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function listWatches(token: string): Promise<Watch[]> {
  const sub = await findBy("token", token);
  if (!sub) return [];
  return adminRest<Watch[]>(`watches?select=id,description&subscriber_id=eq.${sub.id}&order=created_at.asc`);
}

export type AddWatchResult = "added" | "invalid-link" | "too-many" | "too-short";

export async function addWatch(token: string, raw: string): Promise<AddWatchResult> {
  const description = raw.replace(/\s+/g, " ").trim().slice(0, 160);
  if (description.length < 3) return "too-short";
  const sub = await findBy("token", token);
  if (!sub) return "invalid-link";
  const existing = await adminRest<Watch[]>(`watches?select=id,description&subscriber_id=eq.${sub.id}`);
  if (existing.length >= MAX_WATCHES) return "too-many";
  if (existing.some((w) => w.description.toLowerCase() === description.toLowerCase())) return "added";
  await adminRest("watches", { method: "POST", body: { subscriber_id: sub.id, description }, prefer: "return=minimal" });
  return "added";
}

export async function removeWatch(token: string, id: string): Promise<boolean> {
  if (!UUID_RE.test(id)) return false;
  const sub = await findBy("token", token);
  if (!sub) return false;
  await adminRest(`watches?id=eq.${id}&subscriber_id=eq.${sub.id}`, { method: "DELETE", prefer: "return=minimal" });
  return true;
}
