"use server";

import { adminConfigured } from "@/lib/server/admin-db";
import { confirm, normaliseEmail, subscribe, unsubscribe } from "@/lib/server/subscribers";

export type FormState = { ok: boolean; message: string } | null;

export async function subscribeAction(_prev: FormState, form: FormData): Promise<FormState> {
  // Bots fill every field; people never see this one.
  if (form.get("company")) return { ok: true, message: "Check your inbox to confirm." };

  const email = normaliseEmail(String(form.get("email") ?? ""));
  if (!email) return { ok: false, message: "That doesn't look like an email address." };
  if (!adminConfigured()) return { ok: false, message: "Sign-up isn't set up on this server yet." };

  try {
    await subscribe(email);
    return { ok: true, message: "Almost done: check your inbox and click the link to confirm." };
  } catch (err) {
    console.error("[subscribe]", err);
    return { ok: false, message: "Something went wrong. Please try again in a minute." };
  }
}

export async function confirmAction(_prev: FormState, form: FormData): Promise<FormState> {
  const result = await confirm(String(form.get("token") ?? ""));
  return result === "confirmed"
    ? { ok: true, message: "You're in. The next brief arrives tomorrow morning." }
    : { ok: false, message: "This link isn't valid. Try signing up again." };
}

export async function unsubscribeAction(_prev: FormState, form: FormData): Promise<FormState> {
  const result = await unsubscribe(String(form.get("token") ?? ""));
  return result === "unsubscribed"
    ? { ok: true, message: "You've been unsubscribed. No more emails from us." }
    : { ok: false, message: "This link isn't valid. You may already be unsubscribed." };
}
