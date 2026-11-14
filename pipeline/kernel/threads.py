from __future__ import annotations

import hashlib
from pathlib import Path

import numpy as np

from .embed import article_text, embed
from .filter import canonical_url
from .models import Story

THRESHOLDS = {"local": 0.82, "simple": 0.5}


def story_key(story: Story) -> str:
    return hashlib.sha1(canonical_url(story.lead.url).encode()).hexdigest()[:12]


def assign_threads(
    stories: list[Story],
    previous: list[dict],
    backend: str = "local",
    model_dir: Path | None = None,
) -> int:
    for story in stories:
        story.thread_id = story_key(story)
    if not stories or not previous:
        return 0

    today_texts = [article_text(s.headline or s.lead.title, s.summary or s.lead.description) for s in stories]
    past_texts = [article_text(p.get("headline", ""), p.get("summary") or "") for p in previous]
    vectors, used = embed(today_texts + past_texts, backend, model_dir)
    today, past = vectors[: len(stories)], vectors[len(stories):]
    sim = today @ past.T
    threshold = THRESHOLDS[used]

    continued = 0
    for i, story in enumerate(stories):
        j = int(np.argmax(sim[i]))
        if sim[i, j] >= threshold:
            match = previous[j]
            story.thread_id = match.get("thread_id") or match.get("story_key") or story.thread_id
            continued += 1
    return continued
