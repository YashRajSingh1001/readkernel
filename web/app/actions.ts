"use server";

import { TOPICS } from "@/lib/format";
import { parsePrefs, type Prefs } from "@/lib/personal";
import { adminConfigured } from "@/lib/server/admin-db";
import { serverUser } from "@/lib/supabase/server";
import {
  confirm,
  ensureAccountSubscription,
  normaliseEmail,
  savePreferences,
  subscribe,
  unsubscribe,
} from "@/lib/server/subscribers";

export type FormState = { ok: boolean; message: string } | null;

const SIGNUP_SENT = "Almost done: check your inbox and click the link to confirm. Not there? Check your spam folder.";

function prefsFrom(form: FormData): Prefs | undefined {
  if (!form.has("story_count")) return undefined; // plain sign-up box, no builder choices
  return parsePrefs(
    {
      topics: form.get("topics"),
      count: form.get("story_count"),
      format: form.get("format"),
      frequency: form.get("frequency"),
    },
    Object.keys(TOPICS),
  );
}

export async function subscribeAction(_prev: FormState, form: FormData): Promise<FormState> {
  // Bots fill every field; people never see this one.
  if (form.get("company")) return { ok: true, message: SIGNUP_SENT };

  const email = normaliseEmail(String(form.get("email") ?? ""));
  if (!email) return { ok: false, message: "That doesn't look like an email address." };
  if (!adminConfigured()) return { ok: false, message: "Sign-up isn't set up on this server yet." };

  try {
    await subscribe(email, prefsFrom(form));
    return { ok: true, message: SIGNUP_SENT };
  } catch (err) {
    console.error("[subscribe]", err);
    return { ok: false, message: "Something went wrong. Please try again in a minute." };
  }
}

export async function confirmAction(_prev: FormState, form: FormData): Promise<FormState> {
  const result = await confirm(String(form.get("token") ?? ""));
  if (result.status !== "confirmed") return { ok: false, message: "This link isn't valid. Try signing up again." };
  return result.briefSent
    ? { ok: true, message: "You're in. We've just emailed you today's brief (check your spam folder if you don't see it), and the next one arrives tomorrow morning." }
    : { ok: true, message: "You're in. The next brief arrives tomorrow morning." };
}

export async function unsubscribeAction(_prev: FormState, form: FormData): Promise<FormState> {
  const result = await unsubscribe(String(form.get("token") ?? ""));
  return result === "unsubscribed"
    ? { ok: true, message: "You've been unsubscribed. No more emails from us." }
    : { ok: false, message: "This link isn't valid. You may already be unsubscribed." };
}

/** From the link in every email: change topics, length, format, frequency. */
export async function savePreferencesAction(_prev: FormState, form: FormData): Promise<FormState> {
  const prefs = prefsFrom(form);
  if (!prefs) return { ok: false, message: "Nothing to save." };
  try {
    const saved = await savePreferences(String(form.get("token") ?? ""), prefs);
    return saved
      ? { ok: true, message: "Saved. Your next email will follow these settings." }
      : { ok: false, message: "This link isn't valid any more. Use the link in your latest email." };
  } catch (err) {
    console.error("[preferences]", err);
    return { ok: false, message: "Something went wrong. Please try again in a minute." };
  }
}

/** Signed-in readers: their email is already verified, so this subscribes them directly. */
export async function saveAccountPreferencesAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await serverUser();
  if (!user?.email) return { ok: false, message: "Please sign in again." };
  const prefs = prefsFrom(form);
  try {
    await ensureAccountSubscription(user.id, user.email.toLowerCase(), prefs);
    return { ok: true, message: `Saved. The brief goes to ${user.email}.` };
  } catch (err) {
    console.error("[account preferences]", err);
    return { ok: false, message: "Something went wrong. Please try again in a minute." };
  }
}
