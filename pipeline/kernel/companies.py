"""Company tags: which companies a story is about.

The summariser's AI call already returns the company names (no extra
request). This module keeps only names the articles actually contain, so a
name the model remembered but the coverage doesn't mention never becomes a
tag, and turns each name into a slug for /company/<slug>.
"""

from __future__ import annotations

import re

from .models import Story

MAX_TAGS = 4

# Legal suffixes that don't change which company is meant.
_SUFFIX_RE = re.compile(r"[\s,]+(inc|corp|corporation|co|ltd|limited|llc|plc|gmbh|ag|sa)\.?$", re.IGNORECASE)

# Different spellings of the same company, after slugging.
ALIASES = {
    "open-ai": "openai",
    "x-ai": "xai",
    "meta-platforms": "meta",
    "alphabet": "google",
    "amazon-web-services": "aws",
}


def slug(name: str) -> str:
    """'OpenAI Inc.' -> 'openai'; 'Booking.com' -> 'booking-com'."""
    base = _SUFFIX_RE.sub("", name.strip())
    s = re.sub(r"[^a-z0-9]+", "-", base.lower()).strip("-")
    return ALIASES.get(s, s)


def ground(names: list, story: Story) -> list[str]:
    """Names the articles really mention, minus the news outlets, at most MAX_TAGS."""
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
        # Whole-word match, so "Meta" doesn't match "metadata".
        if not re.search(rf"(?<![a-z0-9]){re.escape(name.lower())}(?![a-z0-9])", text):
            continue
        seen.add(key)
        kept.append(name)
        if len(kept) == MAX_TAGS:
            break
    return kept
