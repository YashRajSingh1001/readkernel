import "server-only";

import { randomBytes } from "crypto";

import { adminRest } from "./admin-db";
import { sendMail } from "./mailer";

type Subscriber = {
  id: string;
  email: string;
  status: "pending" | "active" | "unsubscribed";
  token: string;
  confirm_sent_at: string | null;
};

// Don't resend a confirmation email to the same address more often than this.
const RESEND_COOLDOWN_MS = 10 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normaliseEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  return email.length <= 254 && EMAIL_RE.test(email) ? email : null;
}

function siteUrl(): string {
  return (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

async function findBy(column: "email" | "token", value: string): Promise<Subscriber | null> {
  const rows = await adminRest<Subscriber[]>(
    `subscribers?select=id,email,status,token,confirm_sent_at&${column}=eq.${encodeURIComponent(value)}&limit=1`,
  );
  return rows[0] ?? null;
}

async function update(id: string, fields: Partial<Record<string, string | null>>) {
  await adminRest(`subscribers?id=eq.${id}`, { method: "PATCH", body: fields, prefer: "return=minimal" });
}

/**
 * Start (or restart) a subscription. Always resolves the same way whatever the
 * address's state, so the form can't be used to find out who is subscribed.
 */
export async function subscribe(email: string): Promise<void> {
  const now = new Date();
  const existing = await findBy("email", email);

  if (existing?.status === "active") return;

  if (existing) {
    const last = existing.confirm_sent_at ? Date.parse(existing.confirm_sent_at) : 0;
    if (now.getTime() - last < RESEND_COOLDOWN_MS) return;
    await update(existing.id, { confirm_sent_at: now.toISOString() });
    await sendConfirmation(email, existing.token);
    return;
  }

  const token = randomBytes(24).toString("base64url");
  await adminRest("subscribers", {
    method: "POST",
    body: { email, token, status: "pending", confirm_sent_at: now.toISOString() },
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

async function sendConfirmation(email: string, token: string) {
  const link = `${siteUrl()}/confirm?token=${encodeURIComponent(token)}`;
  await sendMail({
    to: email,
    subject: "Confirm your ReadKernel subscription",
    text:
      `Hi! Please confirm you'd like the ReadKernel daily brief:\n\n${link}\n\n` +
      `If you didn't sign up, ignore this email and you won't hear from us again.`,
    html: `<!doctype html><html><body style="margin:0;background:#fbfaf6;font-family:-apple-system,'Segoe UI',Arial,sans-serif;color:#1b1a17;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
<tr><td style="font-family:Georgia,serif;font-size:22px;font-weight:bold;"><span style="color:#c2410c;">&#9679;</span> ReadKernel</td></tr>
<tr><td style="padding-top:20px;font-size:16px;line-height:1.5;">One click and you'll get the day's most important tech and AI stories every morning.</td></tr>
<tr><td style="padding-top:24px;"><a href="${link}" style="display:inline-block;background:#1b1a17;color:#fbfaf6;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold;">Confirm subscription</a></td></tr>
<tr><td style="padding-top:24px;font-size:13px;color:#6b6860;line-height:1.5;">If you didn't sign up, ignore this email and you won't hear from us again.</td></tr>
</table></td></tr></table></body></html>`,
  });
}
