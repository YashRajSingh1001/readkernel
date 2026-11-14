from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from .models import Article, Source

TRACKING_PARAMS = {"fbclid", "gclid", "mc_cid", "mc_eid", "ref", "ref_src", "cmpid", "source"}


def canonical_url(url: str) -> str:
    parts = urlsplit(url.strip())
    query = [
        (k, v)
        for k, v in parse_qsl(parts.query, keep_blank_values=True)
        if not k.lower().startswith("utm_") and k.lower() not in TRACKING_PARAMS
    ]
    host = parts.netloc.lower().removeprefix("www.")
    path = parts.path.rstrip("/") or "/"
    return urlunsplit(("https", host, path, urlencode(query), ""))


def _title_key(title: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", title.lower()).strip()


def _has_word(title: str, words: list[str] | tuple[str, ...]) -> bool:
    lowered = title.lower()
    return any(re.search(rf"(?<![a-z0-9]){re.escape(w)}(?![a-z0-9])", lowered) for w in words)


def filter_articles(
    articles: list[Article],
    sources: list[Source],
    global_exclude: list[str],
    max_age_hours: int,
    now: datetime | None = None,
) -> list[Article]:
    now = now or datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=max_age_hours)
    per_source_exclude = {s.name: s.exclude for s in sources}

    kept: list[Article] = []
    seen_urls: set[str] = set()
    seen_titles: set[str] = set()
    for article in sorted(articles, key=lambda a: (-a.weight, a.published)):
        if article.published < cutoff or article.published > now + timedelta(hours=1):
            continue
        if _has_word(article.title, global_exclude):
            continue
        if _has_word(article.title, per_source_exclude.get(article.source, ())):
            continue
        url_key = canonical_url(article.url)
        title_key = _title_key(article.title)
        if url_key in seen_urls or title_key in seen_titles:
            continue
        seen_urls.add(url_key)
        seen_titles.add(title_key)
        kept.append(article)
    return kept
