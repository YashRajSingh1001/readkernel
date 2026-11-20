import type { SubscribeResult } from "./server/subscribers";

export const CONFIRM_SUBJECT = "Confirm your ReadKernel subscription";

export type SignupState =
  | { ok: true; email: string; message: string; notice?: string }
  | { ok: false; message: string }
  | null;

export function signupState(email: string, result: SubscribeResult, resend: boolean): SignupState {
  const message =
    `We sent a confirmation link to ${email} in an email from ReadKernel titled "${CONFIRM_SUBJECT}". ` +
    "If it isn't in your inbox, check your spam or promotions folder.";
  if (result === "cooldown") return { ok: true, email, message, notice: "We just sent one. You can ask again in a few minutes." };
  return resend ? { ok: true, email, message, notice: "Sent again." } : { ok: true, email, message };
}
