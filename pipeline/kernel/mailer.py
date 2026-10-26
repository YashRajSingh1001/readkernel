"""Send email through SMTP (e.g. Gmail), Resend, or a local preview folder.

EMAIL_TRANSPORT
  preview  (default) write each email to pipeline/data/outbox/ as .eml files; sends nothing
  smtp     any SMTP server. Gmail works free with an app password (~500/day)
  resend   Resend's API (free 3,000/month); needs a domain you own
"""

from __future__ import annotations

import re
import smtplib
import ssl
from dataclasses import dataclass, field
from email.message import EmailMessage
from email.utils import formatdate, make_msgid
from pathlib import Path

import httpx


@dataclass
class Message:
    to: str
    subject: str
    html: str
    text: str
    headers: dict[str, str] = field(default_factory=dict)


def build_mime(msg: Message, sender: str, reply_to: str = "") -> EmailMessage:
    mime = EmailMessage()
    mime["From"] = sender
    if reply_to:
        mime["Reply-To"] = reply_to
    mime["To"] = msg.to
    mime["Subject"] = msg.subject
    mime["Date"] = formatdate(localtime=True)
    mime["Message-ID"] = make_msgid(domain=sender.split("@")[-1].strip(">") or None)
    for key, value in msg.headers.items():
        mime[key] = value
    mime.set_content(msg.text)
    mime.add_alternative(msg.html, subtype="html")
    return mime


class PreviewMailer:
    def __init__(self, sender: str, folder: Path, reply_to: str = ""):
        self.sender, self.reply_to = sender, reply_to
        self.folder = folder
        folder.mkdir(parents=True, exist_ok=True)

    def send(self, msg: Message) -> None:
        name = re.sub(r"[^a-z0-9]+", "_", msg.to.lower()).strip("_")
        path = self.folder / f"{name}.eml"
        path.write_bytes(bytes(build_mime(msg, self.sender, self.reply_to)))
        print(f"    [mail] preview saved: {path}")

    def close(self) -> None:
        pass


class SmtpMailer:
    def __init__(self, sender: str, host: str, port: int, user: str, password: str, reply_to: str = ""):
        self.sender, self.reply_to = sender, reply_to
        self.host, self.port, self.user, self.password = host, port, user, password
        self._smtp: smtplib.SMTP | None = None

    def _connect(self) -> smtplib.SMTP:
        context = ssl.create_default_context()
        if self.port == 465:
            smtp = smtplib.SMTP_SSL(self.host, self.port, context=context, timeout=30)
        else:
            smtp = smtplib.SMTP(self.host, self.port, timeout=30)
            if self.port == 587:
                smtp.starttls(context=context)
        if self.user:
            smtp.login(self.user, self.password)
        return smtp

    def send(self, msg: Message) -> None:
        mime = build_mime(msg, self.sender, self.reply_to)
        for attempt in range(2):
            try:
                if self._smtp is None:
                    self._smtp = self._connect()
                self._smtp.send_message(mime)
                return
            except (smtplib.SMTPServerDisconnected, ConnectionError):
                self._smtp = None  # reconnect once
                if attempt:
                    raise

    def close(self) -> None:
        if self._smtp:
            try:
                self._smtp.quit()
            except smtplib.SMTPException:
                pass


class ResendMailer:
    def __init__(self, sender: str, api_key: str, reply_to: str = ""):
        self.sender, self.reply_to = sender, reply_to
        self.client = httpx.Client(
            headers={"Authorization": f"Bearer {api_key}"}, timeout=30.0
        )

    def send(self, msg: Message) -> None:
        response = self.client.post(
            "https://api.resend.com/emails",
            json={
                "from": self.sender,
                "to": [msg.to],
                "subject": msg.subject,
                "html": msg.html,
                "text": msg.text,
                "headers": msg.headers,
                **({"reply_to": [self.reply_to]} if self.reply_to else {}),
            },
        )
        response.raise_for_status()

    def close(self) -> None:
        self.client.close()


def make_mailer(settings):
    transport = settings.email_transport
    sender = settings.email_from
    reply_to = settings.email_reply_to
    if transport == "preview":
        return PreviewMailer(sender, settings.data_dir / "outbox", reply_to)
    if not sender:
        raise ValueError("Set EMAIL_FROM, e.g. EMAIL_FROM=ReadKernel <you@gmail.com>")
    if transport == "smtp":
        if not settings.smtp_host:
            raise ValueError("EMAIL_TRANSPORT=smtp needs SMTP_HOST (and usually SMTP_USER / SMTP_PASSWORD)")
        return SmtpMailer(
            sender, settings.smtp_host, settings.smtp_port, settings.smtp_user, settings.smtp_password, reply_to
        )
    if transport == "resend":
        if not settings.resend_api_key:
            raise ValueError("EMAIL_TRANSPORT=resend needs RESEND_API_KEY")
        return ResendMailer(sender, settings.resend_api_key, reply_to)
    raise ValueError(f"EMAIL_TRANSPORT must be preview, smtp or resend (got '{transport}')")
