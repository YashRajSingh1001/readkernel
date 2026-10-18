"""Pick each reader's stories from the day's feed ("make it yours").

The website's live preview (web/lib/personal.ts) follows the same rules, so
what a reader sees in the builder is what their email contains.

Rules:
- No topics picked: the daily brief, in brief order. Asking for 15 tops it up
  with the next best feed stories.
- Topics picked: the best stories in those topics, by score.
"""

from __future__ import annotations

VALID_COUNTS = (5, 10, 15)
VALID_FORMATS = ("summaries", "headlines", "images")


def select_stories(brief: list[dict], feed: list[dict], topics: list[str] | None, count: int) -> list[dict]:
    count = count if count in VALID_COUNTS else 10
    by_score = sorted(feed, key=lambda s: -(s.get("score") or 0))
    if not topics:
        picked = list(brief[:count])
        keys = {s.get("story_key") or s["headline"] for s in picked}
        for story in by_score:
            if len(picked) >= count:
                break
            if (story.get("story_key") or story["headline"]) not in keys:
                picked.append(story)
        return picked
    wanted = set(topics)
    return [s for s in by_score if s["topic"] in wanted][:count]


def weekly_stories(rows: list[dict], count: int = 15) -> list[dict]:
    """Best stories of the past week, one per ongoing story (thread)."""
    best: dict[str, dict] = {}
    for row in rows:
        thread = row.get("thread_id") or row.get("story_key") or row["headline"]
        if thread not in best or (row.get("score") or 0) > (best[thread].get("score") or 0):
            best[thread] = row
    return sorted(best.values(), key=lambda s: -(s.get("score") or 0))[:count]
