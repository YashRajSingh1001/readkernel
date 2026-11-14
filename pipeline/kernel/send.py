from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import date, datetime, timedelta, timezone

import httpx

from .company_blogs import LOCAL_FILE as COMPANY_FILE
from .config import load_settings
from .mailer import Message, make_mailer
from .newsletter import links, render
from .personal import VALID_FORMATS, select_stories, weekly_stories
from .store import Supabase

STORY_COLUMNS = (
    "story_key,brief_position,position,headline,summary,why_it_matters,topic,kind,"
    "score,importance,published,image_url,image_credit,thread_id,sources"
)


def load_edition(db: Supabase | None, data_dir, day: str) -> dict | None:
    if db:
        rows = db.select(
            "editions",
            {
                "select": f"date,generated_at,ai,stories({STORY_COLUMNS})",
                "stories.order": "position.asc",
                "date": f"eq.{day}",
            },
        )
        if not rows:
            return None
        edition = rows[0]
        feed = edition.pop("stories")
        brief = sorted((s for s in feed if s.get("brief_position")), key=lambda s: s["brief_position"])
        return {**edition, "stories": brief, "feed": feed}
    path = data_dir / f"brief-{day}.json"
    if not path.exists():
        return None
    data = json.loads(path.read_text(encoding="utf-8"))
    data.setdefault("feed", data.get("stories", []))
    return data


def load_week(db: Supabase, today: str) -> list[dict]:
    start = (date.fromisoformat(today) - timedelta(days=6)).isoformat()
    return db.select(
        "stories",
        {"select": f"edition_date,{STORY_COLUMNS}", "and": f"(edition_date.gte.{start},edition_date.lte.{today})"},
    )


COMPANY_COLUMNS = "url,link,title,company,summary,category,depth,score,added_at"


def load_company_reads(db: Supabase | None, data_dir, weekly: bool) -> list[dict]:
    since = datetime.now(timezone.utc) - (timedelta(days=7) if weekly else timedelta(hours=26))
    try:
        if db:
            rows = db.select(
                "company_posts",
                {"select": COMPANY_COLUMNS, "added_at": f"gte.{since.isoformat()}", "order": "score.desc"},
            )
        else:
            path = data_dir / COMPANY_FILE
            rows = json.loads(path.read_text(encoding="utf-8")) if path.exists() else []
            rows = [r for r in rows if datetime.fromisoformat(r.get("added_at", "1970-01-01T00:00:00+00:00")) >= since]
    except (httpx.HTTPError, ValueError) as exc:
        print(f"[send] company posts unavailable: {exc}")
        return []
    good = sorted((r for r in rows if r.get("depth") is None or r["depth"] >= 3), key=lambda r: -r["score"])
    picked, companies = [], set()
    for row in good:
        if row["company"] not in companies:
            companies.add(row["company"])
            picked.append(row)
    return picked[: 3 if weekly else 1]


def load_alerts(db: Supabase | None, day: str, weekly: bool) -> dict[str, list[dict]]:
    if not db:
        return {}
    start = (date.fromisoformat(day) - timedelta(days=6)).isoformat() if weekly else day
    try:
        rows = db.select(
            "watch_hits",
            {
                "select": "title,summary,url,reason,edition_date,watches!inner(subscriber_id,description)",
                "and": f"(edition_date.gte.{start},edition_date.lte.{day})",
                "order": "found_at.asc",
            },
        )
    except httpx.HTTPError as exc:
        print(f"[send] watch alerts unavailable: {exc}")
        return {}
    alerts: dict[str, list[dict]] = {}
    for row in rows:
        watch = row.pop("watches")
        alerts.setdefault(watch["subscriber_id"], []).append({**row, "wish": watch["description"]})
    return {k: v[:8] for k, v in alerts.items()}


def message_for(
    edition: dict, email: str, token: str | None, site_url: str, fmt: str = "summaries"
) -> Message:
    subject, html, text = render(edition, site_url, token, fmt)
    headers = {}
    one_click = links(site_url, token)["one_click"]
    if one_click:
        headers["List-Unsubscribe"] = f"<{one_click}>"
        headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"
    return Message(to=email, subject=subject, html=html, text=text, headers=headers)


def personal_edition(
    edition: dict,
    pool: list[dict],
    sub: dict,
    weekly: bool,
    company_reads: list[dict] | None = None,
    all_alerts: dict[str, list[dict]] | None = None,
) -> dict:
    topics = sub.get("topics") or []
    reads = company_reads if sub.get("company_read", True) is not False else []
    alerts = (all_alerts or {}).get(sub.get("id"), [])
    count = sub.get("story_count") or 10
    if weekly:
        wanted = [s for s in pool if not topics or s["topic"] in topics]
        stories = weekly_stories(wanted, count)
    else:
        stories = select_stories(edition["stories"], edition["feed"], topics, count)
    return {**edition, "stories": stories, "weekly": weekly, "company_reads": reads or [], "alerts": alerts}


def main() -> None:
    parser = argparse.ArgumentParser(description="Send the ReadKernel email")
    parser.add_argument("--date", help="edition date, YYYY-MM-DD (default: today)")
    parser.add_argument("--weekly", action="store_true", help="send the weekly digest to weekly readers")
    parser.add_argument("--dry-run", action="store_true", help="list recipients, send nothing")
    parser.add_argument("--to", help="send one test email to this address only")
    parser.add_argument("--format", default="summaries", choices=VALID_FORMATS, help="format for --to tests")
    args = parser.parse_args()

    settings = load_settings()
    day = args.date or datetime.now(settings.timezone).date().isoformat()
    kind = "weekly" if args.weekly else "daily"
    db = None
    if settings.supabase_url and settings.supabase_secret_key:
        db = Supabase(settings.supabase_url, settings.supabase_secret_key)

    edition = load_edition(db, settings.data_dir, day)
    if not edition or not edition.get("stories"):
        sys.exit(f"[send] no edition for {day}; run `python -m kernel.run` first")
    week = load_week(db, day) if (args.weekly and db) else edition["feed"]
    company_reads = load_company_reads(db, settings.data_dir, args.weekly)
    alerts = load_alerts(db, day, args.weekly)
    print(f"[send] watch alerts for {len(alerts)} readers")
    print(f"[send] company read: {', '.join(r['title'][:60] for r in company_reads) or 'none new'}")

    if args.to:
        mailer = make_mailer(settings)
        sample = personal_edition(edition, week, {}, args.weekly, company_reads)
        mailer.send(message_for(sample, args.to.strip().lower(), None, settings.site_url, args.format))
        mailer.close()
        print(f"[send] test {kind} email for {day} sent to {args.to} via {settings.email_transport}")
        return

    if not db:
        sys.exit("[send] subscribers live in Supabase; set SUPABASE_URL and SUPABASE_SECRET_KEY")

    filters = {"status": "eq.active", "frequency": f"eq.{kind}"}
    try:
        subscribers = db.select("subscribers", {"select": "id,email,token,topics,story_count,format,company_read", **filters})
    except httpx.HTTPStatusError:
        subscribers = db.select("subscribers", {"select": "id,email,token,topics,story_count,format", **filters})
    already = {
        r["subscriber_id"]
        for r in db.select(
            "email_sends", {"select": "subscriber_id", "edition_date": f"eq.{day}", "kind": f"eq.{kind}"}
        )
    }
    todo = [s for s in subscribers if s["id"] not in already]
    print(f"[send] {kind} {day}: {len(subscribers)} readers, {len(already)} already sent, {len(todo)} to send")
    if args.dry_run:
        for s in todo:
            mine = personal_edition(edition, week, s, args.weekly, company_reads, alerts)
            print(f"   {s['email']}: {len(mine['stories'])} stories, {len(mine['alerts'])} alerts, {s.get('format') or 'summaries'}")
        return

    mailer = make_mailer(settings)
    gap = 60.0 / max(1, settings.send_per_minute)
    sent = failed = 0
    try:
        for s in todo:
            try:
                mine = personal_edition(edition, week, s, args.weekly, company_reads, alerts)
                if not mine["stories"] and not mine["alerts"]:
                    continue
                fmt = s.get("format") if s.get("format") in VALID_FORMATS else "summaries"
                mailer.send(message_for(mine, s["email"], s["token"], settings.site_url, fmt))
                db.insert("email_sends", [{"edition_date": day, "subscriber_id": s["id"], "kind": kind}])
                sent += 1
            except Exception as exc:
                failed += 1
                print(f"   ! {s['email']}: {type(exc).__name__}: {str(exc)[:150]}")
            time.sleep(gap)
    finally:
        mailer.close()
    print(f"[send] done: {sent} sent, {failed} failed")


if __name__ == "__main__":
    main()
