"""Where a finished brief goes.

Always: JSON files in pipeline/data/ (handy locally, and the website can read
them when no database is set up).
When SUPABASE_URL and SUPABASE_SECRET_KEY are set: the editions/stories
tables, written through Supabase's REST API, plus the summary cache.
"""

from __future__ import annotations

import json
from pathlib import Path

import httpx


class Supabase:
    def __init__(self, url: str, key: str):
        self.base = url.rstrip("/") + "/rest/v1"
        headers = {"apikey": key, "Content-Type": "application/json"}
        if key.startswith("eyJ"):  # legacy JWT-style service_role key
            headers["Authorization"] = f"Bearer {key}"
        # retries: reconnect when the server drops an idle connection
        self.client = httpx.Client(
            headers=headers, timeout=30.0, transport=httpx.HTTPTransport(retries=3)
        )

    def upsert(self, table: str, rows: list[dict] | dict) -> None:
        response = self.client.post(
            f"{self.base}/{table}",
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

    def delete(self, table: str, **filters: str) -> None:
        params = {k: f"eq.{v}" for k, v in filters.items()}
        response = self.client.delete(f"{self.base}/{table}", params=params)
        response.raise_for_status()

    def select(self, table: str, params: dict[str, str], page_size: int = 1000) -> list[dict]:
        """All rows matching PostgREST query params, fetched page by page."""
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
    """Same interface as summarise.SummaryCache, stored in summary_cache."""

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
        (data_dir / name).write_text(text, encoding="utf-8")
    return data_dir / "latest.json"


def save_supabase(output: dict, db: Supabase) -> None:
    """Replace today's edition (re-runs during the day overwrite it)."""
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
    db.delete("stories", edition_date=date)
    db.insert(
        "stories",
        [
            {
                "edition_date": date,
                "position": i,  # rank in the day's feed
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
            }
            for i, s in enumerate(output.get("feed") or output["stories"], 1)
        ],
    )
