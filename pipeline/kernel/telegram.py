"""Post the day's brief to a Telegram channel (free).

    python -m kernel.telegram              # post today's brief
    python -m kernel.telegram --dry-run    # print the message instead

Needs TELEGRAM_BOT_TOKEN (from @BotFather) and TELEGRAM_CHAT_ID (e.g.
@readkernel, with the bot added to the channel as an admin). Without them
it does nothing, so the daily job can always call it.
"""

from __future__ import annotations

import argparse
import os
from datetime import datetime
from html import escape

import httpx

from .config import load_settings
from .newsletter import TOPIC_LABELS, long_date
from .send import load_edition
from .store import Supabase

MAX_STORIES = 10


def build_message(edition: dict, site_url: str) -> str:
    lines = [f"<b>ReadKernel · {escape(long_date(edition['date']))}</b>", ""]
    for i, s in enumerate(edition["stories"][:MAX_STORIES], 1):
        url = f"{site_url}/story/{s['story_key']}" if s.get("story_key") else s["sources"][0]["url"]
        topic = TOPIC_LABELS.get(s["topic"], s["topic"])
        lines.append(f'{i}. <a href="{escape(url)}">{escape(s["headline"])}</a> <i>({escape(topic)})</i>')
    lines += ["", f'<a href="{escape(site_url)}/brief/{edition["date"]}">Read the full brief</a>']
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Post today's brief to Telegram")
    parser.add_argument("--date")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    settings = load_settings()
    token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    chat = os.getenv("TELEGRAM_CHAT_ID", "").strip()
    if not args.dry_run and not (token and chat):
        print("[telegram] TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set; skipping")
        return

    day = args.date or datetime.now(settings.timezone).date().isoformat()
    db = Supabase(settings.supabase_url, settings.supabase_secret_key) if settings.supabase_url else None
    edition = load_edition(db, settings.data_dir, day)
    if not edition or not edition.get("stories"):
        print(f"[telegram] no edition for {day}; skipping")
        return

    text = build_message(edition, settings.site_url)
    if args.dry_run:
        print(text)
        return
    response = httpx.post(
        f"https://api.telegram.org/bot{token}/sendMessage",
        json={"chat_id": chat, "text": text, "parse_mode": "HTML", "disable_web_page_preview": True},
        timeout=30,
    )
    response.raise_for_status()
    print(f"[telegram] posted {day} to {chat}")


if __name__ == "__main__":
    main()
