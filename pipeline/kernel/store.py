from __future__ import annotations

import json
from datetime import date, timedelta
from pathlib import Path

import httpx

from .companies import slug


class Supabase:
    def __init__(self, url: str, key: str):
        self.base = url.rstrip("/") + "/rest/v1"
        headers = {"apikey": key, "Content-Type": "application/json"}
        if key.startswith("eyJ"):
            headers["Authorization"] = f"Bearer {key}"
        self.client = httpx.Client(
            headers=headers, timeout=30.0, transport=httpx.HTTPTransport(retries=3)
        )

    def upsert(self, table: str, rows: list[dict] | dict, on_conflict: str | None = None) -> None:
        if not rows:
            return
        response = self.client.post(
            f"{self.base}/{table}",
            params={"on_conflict": on_conflict} if on_conflict else None,
            json=rows,
            headers={"Prefer": "resolution=merge-duplicates,return=minimal"},
        )
        response.raise_for_status()

    def insert(self, table: str, rows: list[dict]) -> None:
        if rows:
            response = self.client.post(
                f"{self.base}/{table}", json=rows, headers={"Prefer": "return=minimal"}
            )
            response.raise_for_status()

    def insert_new(self, table: str, rows: list[dict], key: str) -> None:
        if rows:
            response = self.client.post(
                f"{self.base}/{table}",
                params={"on_conflict": key},
                json=rows,
                headers={"Prefer": "resolution=ignore-duplicates,return=minimal"},
            )
            response.raise_for_status()

    def delete_before(self, table: str, column: str, before: str) -> None:
        response = self.client.delete(f"{self.base}/{table}", params={column: f"lt.{before}"})
        response.raise_for_status()

    def delete(self, table: str, **filters: str) -> None:
        self.delete_where(table, {k: f"eq.{v}" for k, v in filters.items()})

    def delete_where(self, table: str, params: dict[str, str]) -> None:
        response = self.client.delete(f"{self.base}/{table}", params=params)
        response.raise_for_status()

    def select(self, table: str, params: dict[str, str], page_size: int = 1000) -> list[dict]:
        rows: list[dict] = []
        while True:
            page = {**params, "limit": str(page_size), "offset": str(len(rows))}
            response = self.client.get(f"{self.base}/{table}", params=page)
            response.raise_for_status()
            batch = response.json()
            rows.extend(batch)
            if len(batch) < page_size:
                return rows

    def select_one(self, table: str, columns: str, **filters: str) -> dict | None:
        params = {"select": columns, "limit": "1", **{k: f"eq.{v}" for k, v in filters.items()}}
        response = self.client.get(f"{self.base}/{table}", params=params)
        response.raise_for_status()
        rows = response.json()
        return rows[0] if rows else None


class SupabaseCache:
    def __init__(self, db: Supabase):
        self.db = db

    def get(self, key: str) -> dict | None:
        try:
            row = self.db.select_one("summary_cache", "body", key=key)
        except httpx.HTTPError:
            return None
        return row["body"] if row else None

    def put(self, key: str, body: dict) -> None:
        try:
            self.db.upsert("summary_cache", {"key": key, "body": body})
        except httpx.HTTPError as exc:
            print(f"    [store] cache write failed: {exc}")


def save_files(output: dict, data_dir: Path) -> Path:
    data_dir.mkdir(parents=True, exist_ok=True)
    text = json.dumps(output, indent=2, ensure_ascii=False)
    for name in (f"brief-{output['date']}.json", "latest.json"):
        tmp = data_dir / f".{name}.tmp"
        tmp.write_text(text, encoding="utf-8")
        tmp.replace(data_dir / name)
    return data_dir / "latest.json"


def replace_rows(db: Supabase, table: str, date: str, rows: list[dict]) -> None:
    db.delete_where(table, {"edition_date": f"eq.{date}", "position": f"gt.{len(rows)}"})
    db.upsert(table, rows, on_conflict="edition_date,position")


def save_supabase(output: dict, db: Supabase) -> None:
    date = output["date"]
    db.upsert(
        "editions",
        {
            "date": date,
            "generated_at": output["generated_at"],
            "ai": output["ai"],
            "story_count": len(output["stories"]),
            "stats": output["stats"],
        },
    )
    replace_rows(
        db,
        "stories",
        date,
        [
            {
                "edition_date": date,
                "position": i,
                "brief_position": s.get("brief_position"),
                "story_key": s.get("story_key"),
                "headline": s["headline"],
                "summary": s["summary"],
                "why_it_matters": s["why_it_matters"],
                "topic": s["topic"],
                "score": s["score"],
                "importance": s["importance"],
                "published": s["published"],
                "sources": s["sources"],
                "image_url": s.get("image_url"),
                "image_credit": s.get("image_credit"),
                "kind": s.get("kind") or "news",
                "thread_id": s.get("thread_id"),
            }
            for i, s in enumerate(output.get("feed") or output["stories"], 1)
        ],
    )
    save_story_companies(output, db)
    if "discussions" in output:
        replace_rows(
            db,
            "discussions",
            date,
            [
                {
                    "edition_date": date,
                    "position": i,
                    "title": d["title"],
                    "url": d["url"],
                    "comments_url": d.get("comments_url") or None,
                    "source": d["source"],
                    "points": d.get("points"),
                    "comments": d.get("comments"),
                    "summary": d.get("summary") or "",
                }
                for i, d in enumerate(output["discussions"], 1)
            ],
        )


def save_story_companies(output: dict, db: Supabase) -> None:
    date = output["date"]
    rows = {
        (s["story_key"], slug(name)): {"edition_date": date, "story_key": s["story_key"], "company": slug(name), "name": name}
        for s in output.get("feed") or output["stories"]
        if s.get("story_key")
        for name in s.get("companies") or []
    }
    try:
        db.upsert("story_companies", list(rows.values()), on_conflict="edition_date,story_key,company")
        saved = db.select("story_companies", {"select": "story_key,company", "edition_date": f"eq.{date}"})
        stale = {(r["story_key"], r["company"]) for r in saved} - rows.keys()
        for key, company in sorted(stale):
            db.delete("story_companies", edition_date=date, story_key=key, company=company)
    except httpx.HTTPError as exc:
        print(f"    [store] company tags not saved (run db/migrations/007?): {exc}")


def prune_ask_answers(db: Supabase, today: str, keep_days: int = 3) -> None:
    cutoff = (date.fromisoformat(today) - timedelta(days=keep_days)).isoformat()
    try:
        db.delete_before("ask_answers", "created_at", cutoff)
    except httpx.HTTPError as exc:
        print(f"    [store] old Ask answers not pruned (run db/migrations/007?): {exc}")


def load_recent_stories(db: Supabase | None, data_dir: Path, today: str, days: int = 7) -> list[dict]:
    start = (date.fromisoformat(today) - timedelta(days=days)).isoformat()
    if db:
        try:
            return db.select(
                "stories",
                {
                    "select": "story_key,thread_id,headline,summary,edition_date",
                    "and": f"(edition_date.gte.{start},edition_date.lt.{today})",
                },
            )
        except httpx.HTTPError as exc:
            print(f"    [store] could not load past stories: {exc}")
            return []
    rows: list[dict] = []
    for path in sorted(data_dir.glob("brief-*.json")):
        day = path.stem.removeprefix("brief-")
        if start <= day < today:
            data = json.loads(path.read_text(encoding="utf-8"))
            for s in data.get("feed") or data.get("stories") or []:
                rows.append({**s, "edition_date": day})
    return rows
