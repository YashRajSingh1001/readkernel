from __future__ import annotations

import html
import re
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urljoin

import httpx

from .fetch import USER_AGENT
from .models import Story

PAGE_BYTES = 300_000
TIMEOUT = 8.0
MAX_PAGES_PER_STORY = 3

_META_RE = re.compile(
    r"""<meta[^>]+(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image(?::src)?)["'][^>]*>""",
    flags=re.IGNORECASE,
)
_CONTENT_RE = re.compile(r"""content=["']([^"']+)["']""", flags=re.IGNORECASE)
_SKIP_HOSTS = ("news.ycombinator.com", "twitter.com", "x.com", "github.com")


def page_preview_image(html_text: str, page_url: str) -> str:
    for tag in _META_RE.findall(html_text):
        match = _CONTENT_RE.search(tag)
        if match:
            url = urljoin(page_url, html.unescape(match.group(1).strip()))
            if url.startswith("https://"):
                return url
    return ""


def _fetch_preview(client: httpx.Client, url: str) -> str:
    if any(host in url for host in _SKIP_HOSTS):
        return ""
    try:
        with client.stream("GET", url) as response:
            if response.status_code != 200 or "html" not in response.headers.get("content-type", ""):
                return ""
            body = b""
            for chunk in response.iter_bytes():
                body += chunk
                if len(body) >= PAGE_BYTES:
                    break
        return page_preview_image(body.decode("utf-8", errors="ignore"), str(response.url))
    except httpx.HTTPError:
        return ""


def attach_images(stories: list[Story], fetch_pages: bool = True, workers: int = 10) -> int:
    need_page: list[Story] = []
    for story in stories:
        with_photo = next((a for a in story.articles if a.image_url), None)
        if with_photo:
            story.image_url, story.image_credit = with_photo.image_url, with_photo.source
        else:
            need_page.append(story)

    if fetch_pages and need_page:
        headers = {"User-Agent": USER_AGENT, "Accept": "text/html"}
        with httpx.Client(headers=headers, timeout=TIMEOUT, follow_redirects=True) as client:
            with ThreadPoolExecutor(max_workers=workers) as pool:
                found = list(pool.map(lambda s: _first_page_preview(client, s), need_page))
        for story, hit in zip(need_page, found):
            if hit:
                story.image_url, story.image_credit = hit
    return sum(1 for s in stories if s.image_url)


def _first_page_preview(client: httpx.Client, story: Story, tries: int = MAX_PAGES_PER_STORY) -> tuple[str, str] | None:
    for article in story.articles[:tries]:
        url = _fetch_preview(client, article.url)
        if url:
            return url, article.source
    return None
