from __future__ import annotations

import re

from .models import Story

MAX_TAGS = 4

_SUFFIX_RE = re.compile(r"[\s,]+(inc|corp|corporation|co|ltd|limited|llc|plc|gmbh|ag|sa)\.?$", re.IGNORECASE)

ALIASES = {
    "open-ai": "openai",
    "x-ai": "xai",
    "meta-platforms": "meta",
    "alphabet": "google",
    "amazon-web-services": "aws",
}


def slug(name: str) -> str:
    base = _SUFFIX_RE.sub("", name.strip())
    s = re.sub(r"[^a-z0-9]+", "-", base.lower()).strip("-")
    return ALIASES.get(s, s)


def ground(names: list, story: Story) -> list[str]:
    text = " ".join(f"{a.title} {a.description}" for a in story.articles).lower()
    outlets = {slug(source) for source in story.sources}
    kept: list[str] = []
    seen: set[str] = set()
    for raw in names:
        if not isinstance(raw, str):
            continue
        name = _SUFFIX_RE.sub("", raw.strip())
        key = slug(name)
        if not key or len(name) > 60 or key in seen or key in outlets:
            continue
        if not re.search(rf"(?<![a-z0-9]){re.escape(name.lower())}(?![a-z0-9])", text):
            continue
        seen.add(key)
        kept.append(name)
        if len(kept) == MAX_TAGS:
            break
    return kept
