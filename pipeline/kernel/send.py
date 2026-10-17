"""Email a day's brief to every confirmed subscriber.

    python -m kernel.send                      # today's edition, all active subscribers
    python -m kernel.send --dry-run            # show who would get it, send nothing
    python -m kernel.send --to me@example.com  # one test email (not logged)
    python -m kernel.send --date 2026-10-18

Every successful send is logged in email_sends, so running it twice in a day
only reaches people who were missed (new confirmations, earlier failures).
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime

from .config import load_settings
from .mailer import Message, make_mailer
from .newsletter import links, render
from .store import Supabase

STORY_COLUMNS = "headline,summary,why_it_matters,topic,score,importance,published,sources"


def load_edition(db: Supabase | None, data_dir, day: str) -> dict | None:
    if db:
        rows = db.select(
            "editions",
            {
                "select": f"date,generated_at,ai,stories(position,{STORY_COLUMNS})",
                "stories.order": "position.asc",
                "date": f"eq.{day}",
            },
        )
        return rows[0] if rows else None
    path = data_dir / f"brief-{day}.json"
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else None


def message_for(edition: dict, email: str, token: str | None, site_url: str) -> Message:
    subject, html, text = render(edition, site_url, token)
    headers = {}
    one_click = links(site_url, token)["one_click"]
    if one_click:
        # Lets Gmail/Outlook show their own "Unsubscribe" button (RFC 8058).
        headers["List-Unsubscribe"] = f"<{one_click}>"
        headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"
    return Message(to=email, subject=subject, html=html, text=text, headers=headers)


def main() -> None:
    parser = argparse.ArgumentParser(description="Send the ReadKernel daily email")
    parser.add_argument("--date", help="edition date, YYYY-MM-DD (default: today)")
    parser.add_argument("--dry-run", action="store_true", help="list recipients, send nothing")
    parser.add_argument("--to", help="send one test email to this address only")
    args = parser.parse_args()

    settings = load_settings()
    day = args.date or datetime.now(settings.timezone).date().isoformat()
    db = None
    if settings.supabase_url and settings.supabase_secret_key:
        db = Supabase(settings.supabase_url, settings.supabase_secret_key)

    edition = load_edition(db, settings.data_dir, day)
    if not edition or not edition.get("stories"):
        sys.exit(f"[send] no edition for {day}; run `python -m kernel.run` first")

    if args.to:
        mailer = make_mailer(settings)
        mailer.send(message_for(edition, args.to.strip().lower(), None, settings.site_url))
        mailer.close()
        print(f"[send] test email for {day} sent to {args.to} via {settings.email_transport}")
        return

    if not db:
        sys.exit("[send] subscribers live in Supabase; set SUPABASE_URL and SUPABASE_SECRET_KEY")

    subscribers = db.select("subscribers", {"select": "id,email,token", "status": "eq.active"})
    already = {
        r["subscriber_id"]
        for r in db.select("email_sends", {"select": "subscriber_id", "edition_date": f"eq.{day}"})
    }
    todo = [s for s in subscribers if s["id"] not in already]
    print(f"[send] {day}: {len(subscribers)} active, {len(already)} already sent, {len(todo)} to send")
    if args.dry_run:
        for s in todo:
            print(f"   would send to {s['email']}")
        return

    mailer = make_mailer(settings)
    gap = 60.0 / max(1, settings.send_per_minute)
    sent = failed = 0
    try:
        for s in todo:
            try:
                mailer.send(message_for(edition, s["email"], s["token"], settings.site_url))
                db.insert("email_sends", [{"edition_date": day, "subscriber_id": s["id"]}])
                sent += 1
            except Exception as exc:  # one bad address must not stop the rest
                failed += 1
                print(f"   ! {s['email']}: {type(exc).__name__}: {str(exc)[:150]}")
            time.sleep(gap)
    finally:
        mailer.close()
    print(f"[send] done: {sent} sent, {failed} failed")


if __name__ == "__main__":
    main()
