"""Link today's stories to the same ongoing story on earlier days.

Each story gets a thread_id. If today's story closely matches one from the
past week (same embeddings as story grouping), it inherits that story's
thread_id; otherwise it starts a new thread named after its own story_key.
The story page then shows the thread as a timeline.
"""

from __future__ import annotations

import hashlib
from pathlib import Path

import numpy as np

from .embed import article_text, embed
from .filter import canonical_url
from .models import Story

# Stricter than same-day grouping: across days we want "the same saga", not
# "the same company".
THRESHOLDS = {"local": 0.82, "simple": 0.5}


def story_key(story: Story) -> str:
    """Stable id for the story's page, from its lead article's link."""
    return hashlib.sha1(canonical_url(story.lead.url).encode()).hexdigest()[:12]


def assign_threads(
    stories: list[Story],
    previous: list[dict],
    backend: str = "local",
    model_dir: Path | None = None,
) -> int:
    """Set story.thread_id on every story. Returns how many continue an older thread.

    `previous` rows need: story_key, thread_id (may be empty), headline, summary.
    """
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
