"""MCP server: lets AI assistants (Claude Code, Claude Desktop, Cursor...) read ReadKernel.

Read-only. It reads the same data as the website:
- Supabase, when SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are set. The
  publishable key can only read (Row Level Security), so the server can never
  change anything. It never uses SUPABASE_SECRET_KEY.
- Otherwise the pipeline's JSON files in pipeline/data (DATA_DIR).

Run it (stdio):  python -m kernel.mcp_server
Add it to Claude Code (from pipeline/):
    claude mcp add readkernel -e PYTHONPATH="$PWD" -- "$PWD/.venv/bin/python" -m kernel.mcp_server
"""

from __future__ import annotations

import json
import os
import re
import sys
from datetime import date as Date
from pathlib import Path
from typing import Any

from mcp.server.mcpserver import MCPServer
from mcp.server.mcpserver.exceptions import ResourceError, ToolError
from mcp.types import ToolAnnotations

from .config import load_settings
from .sources import TOPICS, load_sources
from .store import Supabase

KEY_RE = re.compile(r"^[a-z0-9-]{6,40}$")  # story keys and thread ids, as on the website
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
MAX_LIMIT = 30

STORY_COLUMNS = (
    "story_key,brief_position,position,headline,summary,why_it_matters,topic,kind,score,importance,"
    "published,image_url,image_credit,thread_id,sources"
)
DISCUSSION_COLUMNS = "position,title,url,comments_url,source,points,comments,summary"


# --- Input checks (every value that reaches a database filter goes through one) ---


def check_date(value: str) -> str:
    try:
        if DATE_RE.match(value) and Date.fromisoformat(value):
            return value
    except ValueError:
        pass
    raise ToolError(f"date must be YYYY-MM-DD, got {value!r}")


def check_key(value: str) -> str:
    if not KEY_RE.match(value):
        raise ToolError(f"not a story key or thread id: {value!r}")
    return value


def check_topic(value: str) -> str:
    if value not in TOPICS:
        raise ToolError(f"topic must be one of {', '.join(sorted(TOPICS))}")
    return value


def clamp(limit: int) -> int:
    return max(1, min(int(limit), MAX_LIMIT))


# --- Readers: the database, or local JSON files ---


class DbReader:
    """Reads Supabase through its REST API with the publishable (read-only) key."""

    def __init__(self, url: str, publishable_key: str):
        self.db = Supabase(url, publishable_key)  # only .client.get is used

    def _get(self, table: str, params: dict[str, str]) -> list[dict]:
        response = self.db.client.get(f"{self.db.base}/{table}", params=params)
        response.raise_for_status()
        return response.json()

    def edition(self, date: str | None) -> dict | None:
        params = {
            "select": f"date,generated_at,ai,stories({STORY_COLUMNS}),discussions({DISCUSSION_COLUMNS})",
            "stories.order": "position.asc",
            "discussions.order": "position.asc",
        }
        if date:
            params["date"] = f"eq.{date}"
        else:
            params.update(order="date.desc", limit="1")  # latest edition, not "today"
        rows = self._get("editions", params)
        if not rows:
            return None
        row = rows[0]
        feed = row.get("stories") or []
        brief = sorted((s for s in feed if s.get("brief_position") is not None), key=lambda s: s["brief_position"])
        return {**row, "stories": brief, "feed": feed, "discussions": row.get("discussions") or []}

    def editions(self, limit: int) -> list[dict]:
        rows = self._get(
            "editions",
            {
                "select": "date,story_count,stories(headline)",
                "stories.brief_position": "eq.1",
                "order": "date.desc",
                "limit": str(limit),
            },
        )
        return [
            {"date": r["date"], "story_count": r["story_count"], "lead": (r.get("stories") or [{}])[0].get("headline")}
            for r in rows
        ]

    def search(self, query: str, limit: int) -> list[dict]:
        return self._get(
            "stories",
            {
                "select": f"edition_date,{STORY_COLUMNS}",
                "search": f"wfts(english).{query}",  # websearch syntax: words, "phrases", -excluded
                "order": "edition_date.desc,score.desc",
                "limit": str(limit),
            },
        )

    def thread(self, key: str) -> list[dict]:
        return self._get(
            "stories",
            {
                "select": f"edition_date,{STORY_COLUMNS}",
                # A thread is named after its first story, which may predate thread ids.
                "or": f"(thread_id.eq.{key},story_key.eq.{key})",
                "order": "edition_date.desc,score.desc",
                "limit": "60",
            },
        )


class FileReader:
    """Reads brief-YYYY-MM-DD.json files written by the pipeline."""

    def __init__(self, data_dir: Path):
        self.data_dir = data_dir

    def _dates(self) -> list[str]:
        if not self.data_dir.is_dir():
            return []
        found = (re.fullmatch(r"brief-(\d{4}-\d{2}-\d{2})\.json", p.name) for p in self.data_dir.iterdir())
        return sorted((m.group(1) for m in found if m), reverse=True)

    def _load(self, date: str) -> dict | None:
        path = self.data_dir / f"brief-{date}.json"
        if not path.is_file():
            return None
        raw = json.loads(path.read_text(encoding="utf-8"))
        # Files from before the feed existed only have the brief.
        return {**raw, "feed": raw.get("feed") or raw.get("stories") or [], "discussions": raw.get("discussions") or []}

    def edition(self, date: str | None) -> dict | None:
        if date is None:
            dates = self._dates()
            return self._load(dates[0]) if dates else None
        return self._load(date)

    def editions(self, limit: int) -> list[dict]:
        out = []
        for date in self._dates()[:limit]:
            e = self._load(date) or {}
            brief = e.get("stories") or []
            out.append({"date": date, "story_count": len(brief), "lead": brief[0]["headline"] if brief else None})
        return out

    def search(self, query: str, limit: int) -> list[dict]:
        words = query.lower().split()
        found: list[dict] = []
        for date in self._dates():
            for s in (self._load(date) or {}).get("feed", []):
                text = f"{s.get('headline', '')} {s.get('summary', '')}".lower()
                if all(w in text for w in words):
                    found.append({**s, "edition_date": date})
            if len(found) >= limit:
                break
        return found[:limit]

    def thread(self, key: str) -> list[dict]:
        rows = []
        for date in self._dates()[:30]:
            for s in (self._load(date) or {}).get("feed", []):
                if s.get("thread_id") == key or s.get("story_key") == key:
                    rows.append({**s, "edition_date": date})
        return rows


def make_reader() -> DbReader | FileReader:
    settings = load_settings()  # also loads .env files
    url = os.getenv("SUPABASE_URL", "").strip()
    key = os.getenv("SUPABASE_PUBLISHABLE_KEY", "").strip()
    if url and key and os.getenv("READ_LOCAL_DATA") != "1":
        return DbReader(url, key)
    if url and os.getenv("SUPABASE_SECRET_KEY"):
        # stderr, because stdout is the MCP channel
        print(
            "[readkernel-mcp] SUPABASE_PUBLISHABLE_KEY is not set; reading local files. "
            "The secret key is never used here.",
            file=sys.stderr,
        )
    return FileReader(settings.data_dir)


# --- What the assistant sees ---


def site_url() -> str:
    return os.getenv("SITE_URL", "").strip().rstrip("/")


def compact(story: dict) -> dict:
    """A story without layout-only fields, so results stay small in an assistant's context."""
    out = {
        "story_key": story.get("story_key"),
        "headline": story.get("headline"),
        "summary": story.get("summary"),
        "why_it_matters": story.get("why_it_matters"),
        "topic": story.get("topic"),
        "kind": story.get("kind", "news"),
        "published": story.get("published"),
        "thread_id": story.get("thread_id"),
        "sources": [{"name": s.get("name"), "title": s.get("title"), "url": s.get("url")} for s in story.get("sources") or []],
    }
    if story.get("edition_date"):
        out["date"] = story["edition_date"]
    if site_url() and story.get("story_key"):
        out["link"] = f"{site_url()}/story/{story['story_key']}"
    return out


def one_per_day(rows: list[dict]) -> list[dict]:
    """Newest first, the top-scored version of the story on each day."""
    rows = sorted(rows, key=lambda r: (r["edition_date"], r.get("score") or 0), reverse=True)
    seen: dict[str, dict] = {}
    for r in rows:
        seen.setdefault(r["edition_date"], r)
    return list(seen.values())


def build_server(reader: DbReader | FileReader | None = None) -> MCPServer:
    reader = reader or make_reader()
    server = MCPServer(
        name="readkernel",
        instructions=(
            "ReadKernel is a daily tech and AI news brief: each day's top stories, merged across many "
            "sources and summarised, with every source linked. Use get_brief for today's top stories, "
            "search_stories for anything in the archive, and get_story_thread to follow a story over days. "
            "Cite the source URLs in your answer."
        ),
    )
    read_only = ToolAnnotations(read_only_hint=True, open_world_hint=False)

    def edition_or_fail(date: str | None) -> dict:
        edition = reader.edition(check_date(date) if date else None)
        if edition is None:
            raise ToolError(f"no brief for {date}; call list_editions to see which days exist" if date else "no briefs yet")
        return edition

    @server.tool(annotations=read_only)
    def get_brief(date: str | None = None) -> dict[str, Any]:
        """The day's brief: its top stories in order, each with a summary, why it matters, and sources.

        date: YYYY-MM-DD. Leave empty for the latest brief.
        """
        e = edition_or_fail(date)
        return {"date": e["date"], "generated_at": e.get("generated_at"), "stories": [compact(s) for s in e["stories"]]}

    @server.tool(annotations=read_only)
    def get_feed(date: str | None = None, topic: str | None = None, limit: int = 10) -> dict[str, Any]:
        """The whole day's stories (about 30, best first), optionally for one topic.

        topic: ai, tech, dev, startups, security, markets or design.
        """
        e = edition_or_fail(date)
        feed = [s for s in e["feed"] if not topic or s.get("topic") == check_topic(topic)]
        return {"date": e["date"], "topic": topic, "total": len(feed), "stories": [compact(s) for s in feed[: clamp(limit)]]}

    @server.tool(annotations=read_only)
    def search_stories(query: str, limit: int = 10) -> dict[str, Any]:
        """Search every past story's headline and summary, newest first.

        Supports plain words, "quoted phrases" and -excluded words.
        """
        q = query.strip()[:100]
        if len(q) < 2:
            raise ToolError("query must be at least 2 characters")
        return {"query": q, "stories": [compact(s) for s in reader.search(q, clamp(limit))]}

    @server.tool(annotations=read_only)
    def get_story_thread(key: str) -> dict[str, Any]:
        """How an ongoing story developed: one version per day, newest first.

        key: a story's story_key or thread_id from another tool's result.
        """
        days = one_per_day(reader.thread(check_key(key)))
        return {"key": key, "days": len(days), "stories": [compact(s) for s in days]}

    @server.tool(annotations=read_only)
    def list_editions(limit: int = 14) -> dict[str, Any]:
        """The days that have a brief, newest first, with each day's lead headline."""
        return {"editions": reader.editions(clamp(limit))}

    @server.tool(annotations=read_only)
    def get_top_discussions(date: str | None = None) -> dict[str, Any]:
        """The day's most-upvoted Hacker News posts, each with a one-line summary."""
        e = edition_or_fail(date)
        keep = ("title", "url", "comments_url", "points", "comments", "summary")
        return {"date": e["date"], "discussions": [{k: d.get(k) for k in keep} for d in e["discussions"]]}

    @server.tool(annotations=read_only)
    def list_sources(topic: str | None = None) -> dict[str, Any]:
        """The news sources ReadKernel reads, with their topic and ranking weight."""
        sources, _ = load_sources(load_settings().sources_file)
        rows = [s for s in sources if not topic or s.topic == check_topic(topic)]
        return {"count": len(rows), "sources": [{"name": s.name, "topic": s.topic, "weight": s.weight} for s in rows]}

    @server.resource("readkernel://brief/latest", name="latest-brief", mime_type="application/json")
    def latest_brief() -> str:
        """The latest brief, as JSON."""
        try:
            return json.dumps(get_brief(), ensure_ascii=False)
        except ToolError as exc:
            raise ResourceError(str(exc)) from exc

    return server


def main() -> None:
    build_server().run("stdio")


if __name__ == "__main__":
    main()
