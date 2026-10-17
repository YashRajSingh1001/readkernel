"""Download RSS/Atom feeds and turn entries into Articles."""

from __future__ import annotations

import html
import re
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

import feedparser
import httpx

from .models import Article, Source

USER_AGENT = "ReadKernel/0.1 (+news brief; RSS reader)"
TIMEOUT = 15.0
MAX_DESCRIPTION = 700

_TAG_RE = re.compile(r"<[^>]+>")
_SPACE_RE = re.compile(r"\s+")
# Boilerplate that feeds tack onto descriptions.
_NOISE_RE = re.compile(
    r"(\[(?:\.\.\.|…)\]|(?:\.\.\.|…)\s*$|The post .{0,200}? appeared first on .{0,100}?\.?\s*$"
    r"|(?:Continue|Read more|Read the full).{0,40}$)",
    flags=re.IGNORECASE,
)
# Link aggregators (Hacker News) send only "Article URL / Comments URL / Points".
_AGGREGATOR_RE = re.compile(r"^\s*Article URL:", flags=re.IGNORECASE)


def clean_text(value: str) -> str:
    """Strip HTML tags and entities, collapse whitespace."""
    text = _TAG_RE.sub(" ", value or "")
    text = html.unescape(text)
    return _SPACE_RE.sub(" ", text).strip()


def clean_description(value: str) -> str:
    text = clean_text(value)
    if _AGGREGATOR_RE.match(text):
        return ""
    return _NOISE_RE.sub("", text).strip()


def _entry_time(entry) -> datetime | None:
    for key in ("published_parsed", "updated_parsed", "created_parsed"):
        parsed = entry.get(key)
        if parsed:
            return datetime(*parsed[:6], tzinfo=timezone.utc)
    return None


def parse_feed(content: bytes, source: Source) -> list[Article]:
    feed = feedparser.parse(content)
    articles: list[Article] = []
    for entry in feed.entries:
        url = (entry.get("link") or "").strip()
        title = clean_text(entry.get("title", ""))
        published = _entry_time(entry)
        if not url or not title or not published:
            continue
        description = entry.get("summary") or ""
        if not description and entry.get("content"):
            description = entry["content"][0].get("value", "")
        articles.append(
            Article(
                url=url,
                title=title,
                description=clean_description(description)[:MAX_DESCRIPTION],
                source=source.name,
                topic=source.topic,
                weight=source.weight,
                published=published,
            )
        )
    return articles


def fetch_source(client: httpx.Client, source: Source) -> list[Article]:
    try:
        response = client.get(source.url)
    except httpx.TimeoutException:
        response = client.get(source.url)  # slow feeds often answer the second time
    response.raise_for_status()
    return parse_feed(response.content, source)


def fetch_all(sources: list[Source], workers: int = 12) -> tuple[list[Article], dict[str, str]]:
    """Fetch every source in parallel. Returns (articles, {source_name: error})."""
    articles: list[Article] = []
    errors: dict[str, str] = {}
    headers = {"User-Agent": USER_AGENT, "Accept": "application/rss+xml, application/atom+xml, */*"}
    with httpx.Client(headers=headers, timeout=TIMEOUT, follow_redirects=True) as client:
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = {pool.submit(fetch_source, client, s): s for s in sources}
            for future, source in futures.items():
                try:
                    articles.extend(future.result())
                except Exception as exc:  # one bad feed must not stop the run
                    errors[source.name] = f"{type(exc).__name__}: {exc}"[:200]
    return articles, errors
