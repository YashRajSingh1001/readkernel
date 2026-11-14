import "server-only";

import nodemailer from "nodemailer";


export type Mail = { to: string; subject: string; html: string; text: string; headers?: Record<string, string> };

function transportName(): string {
  return (process.env.EMAIL_TRANSPORT || "preview").toLowerCase();
}

export function isPreviewTransport(): boolean {
  return transportName() === "preview";
}

export async function sendMail(mail: Mail): Promise<void> {
  const transport = transportName();
  const from = process.env.EMAIL_FROM || "ReadKernel <preview@localhost>";
  const replyTo = process.env.EMAIL_REPLY_TO || undefined;

  if (transport === "preview") {
    console.log(`[mail preview] to=${mail.to} subject="${mail.subject}"\n${mail.text}\n`);
    return;
  }

  if (transport === "smtp") {
    const port = Number(process.env.SMTP_PORT || 587);
    const smtp = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
    });
    await smtp.sendMail({ from, replyTo, ...mail });
    return;
  }

  if (transport === "resend") {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [mail.to],
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        ...(replyTo ? { reply_to: [replyTo] } : {}),
        ...(mail.headers ? { headers: mail.headers } : {}),
      }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
    return;
  }

  throw new Error(`EMAIL_TRANSPORT must be preview, smtp or resend (got "${transport}")`);
}
