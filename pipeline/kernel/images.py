"""Pick a photo for each story.

We only use the image a publisher itself offers for link previews: the photo
in its RSS entry, or the og:image / twitter:image tag on the article page (the
picture X, LinkedIn and Slack show when the link is shared). We never download
or re-host it; the site shows it from the publisher, with a credit line.
"""

from __future__ import annotations

import html
import re
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urljoin

import httpx

from .fetch import USER_AGENT
from .models import Story

PAGE_BYTES = 300_000  # preview tags live in <head>; no need for the whole page
TIMEOUT = 8.0

_META_RE = re.compile(
    r"""<meta[^>]+(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image(?::src)?)["'][^>]*>""",
    flags=re.IGNORECASE,
)
_CONTENT_RE = re.compile(r"""content=["']([^"']+)["']""", flags=re.IGNORECASE)
# Sites whose links are discussions, not articles with photos.
_SKIP_HOSTS = ("news.ycombinator.com", "twitter.com", "x.com", "github.com")


def page_preview_image(html_text: str, page_url: str) -> str:
    """The og:image / twitter:image a page declares, as an absolute https URL."""
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
    """Set image_url + image_credit on each story. Returns how many got a photo."""
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
                found = list(pool.map(lambda s: _fetch_preview(client, s.lead.url), need_page))
        for story, url in zip(need_page, found):
            if url:
                story.image_url, story.image_credit = url, story.lead.source
    return sum(1 for s in stories if s.image_url)
