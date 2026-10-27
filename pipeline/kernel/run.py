"""Run the whole pipeline and print today's brief.

    python -m kernel.run                 # full run with the configured AI
    python -m kernel.run --no-ai         # free, offline-friendly run without AI
    python -m kernel.run --top 15
"""

from __future__ import annotations

import argparse
import time
from datetime import datetime, timezone

from .config import load_settings
from .discussions import collect_discussions, discussion_to_dict
from .factcheck import fact_check
from .fetch import fetch_all
from .filter import filter_articles
from .group import group_articles
from .images import attach_images
from .llm import make_llm
from .models import Story
from .rank import pick_brief, pick_feed, rank_stories
from .sources import load_sources
from .store import Supabase, SupabaseCache, load_recent_stories, save_files, save_supabase
from .summarise import SummaryCache, summarise
from .threads import assign_threads, story_key

__all__ = ["main", "story_key", "story_to_dict"]


def _log(msg: str) -> None:
    print(f"[kernel] {msg}", flush=True)


def story_to_dict(story: Story, brief_position: int | None = None) -> dict:
    return {
        "story_key": story_key(story),
        "brief_position": brief_position,
        "headline": story.headline,
        "summary": story.summary,
        "why_it_matters": story.why_it_matters,
        "topic": story.topic,
        "kind": story.kind,
        "score": round(story.score, 3),
        "importance": story.importance,
        "published": story.newest.isoformat(),
        "image_url": story.image_url or None,
        "image_credit": story.image_credit or None,
        "thread_id": story.thread_id or story_key(story),
        "sources": [
            {"name": a.source, "title": a.title, "url": a.url, "published": a.published.isoformat()}
            for a in story.articles
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Build today's ReadKernel brief")
    parser.add_argument("--top", type=int, help="number of stories (default from STORIES_PER_BRIEF)")
    parser.add_argument("--no-ai", action="store_true", help="skip all AI calls")
    parser.add_argument("--no-db", action="store_true", help="only write local JSON, skip Supabase")
    parser.add_argument("--no-images", action="store_true", help="don't look up photos on article pages")
    args = parser.parse_args()

    settings = load_settings()
    llm = None if args.no_ai else make_llm(settings)
    top = args.top or settings.stories_per_brief
    started = time.time()
    _log(f"AI: {llm or 'off'}")

    sources, global_exclude = load_sources(settings.sources_file)
    articles, errors = fetch_all(sources)
    _log(f"fetched {len(articles)} articles from {len(sources) - len(errors)}/{len(sources)} sources")
    for name, error in errors.items():
        _log(f"  ! {name}: {error}")

    fresh = filter_articles(articles, sources, global_exclude, settings.max_age_hours)
    _log(f"kept {len(fresh)} after filtering (last {settings.max_age_hours}h, no junk, no dupes)")

    model_dir = settings.data_dir / "models"
    stories = group_articles(fresh, llm, settings.embeddings, model_dir)
    multi = sum(1 for s in stories if len(s.sources) > 1)
    _log(f"grouped into {len(stories)} stories ({multi} covered by 2+ sources)")

    db = None
    if settings.supabase_url and settings.supabase_secret_key and not args.no_db:
        db = Supabase(settings.supabase_url, settings.supabase_secret_key)
    cache = SupabaseCache(db) if db else SummaryCache(settings.data_dir / "cache.sqlite3")

    ranked = rank_stories(stories, llm)
    brief = pick_brief(ranked, top)
    feed = pick_feed(ranked, brief, max(settings.feed_size, len(brief)))
    summarise(feed, llm, cache)
    checked = fact_check(feed, llm, cache)
    _log(f"fact-check: {checked['ok']} ok, {checked['fixed']} fixed, {checked['fallback']} replaced by the publisher's words, {checked['unchecked']} not checked")
    brief_rank = {id(s): i for i, s in enumerate(brief, 1)}

    with_photo = attach_images(feed, fetch_pages=not args.no_images)
    _log(f"photos: {with_photo}/{len(feed)} stories")

    today = datetime.now(settings.timezone).date().isoformat()
    previous = load_recent_stories(db, settings.data_dir, today, days=7)
    continued = assign_threads(feed, previous, settings.embeddings, model_dir)
    _log(f"threads: {continued} stories continue an earlier one (checked {len(previous)} from the past week)")

    discussions = collect_discussions(llm, settings.max_age_hours)
    _log(f"top articles: {len(discussions)} discussions")

    output = {
        "date": today,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "ai": str(llm) if llm else None,
        "stats": {
            "sources": len(sources),
            "failed_sources": sorted(errors),
            "articles": len(articles),
            "kept": len(fresh),
            "stories": len(stories),
            "feed": len(feed),
            "fact_check": checked,
        },
        # "stories" is the brief (in brief order); "feed" is the whole day, by score.
        "stories": [story_to_dict(s, i) for i, s in enumerate(brief, 1)],
        "feed": [story_to_dict(s, brief_rank.get(id(s))) for s in feed],
        "discussions": [discussion_to_dict(d) for d in discussions],
    }
    latest = save_files(output, settings.data_dir)
    if db:
        save_supabase(output, db)
        _log(f"saved edition {today} to Supabase")

    print()
    print(f"  ReadKernel brief - {today}")
    print("  " + "=" * 60)
    for i, story in enumerate(brief, 1):
        count = len(story.sources)
        label = f"{count} sources" if count > 1 else story.sources[0]
        print(f"\n  {i:>2}. {story.headline}")
        print(f"      [{story.topic}{', model release' if story.kind == 'model_release' else ''}] {label}")
        if story.summary:
            print(f"      {story.summary}")
    print()
    _log(f"feed: {len(feed)} stories (brief: {len(brief)}); done in {time.time() - started:.0f}s -> {latest}")


if __name__ == "__main__":
    main()
