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
from .fetch import fetch_all
from .filter import filter_articles
from .group import group_articles
from .llm import make_llm
from .models import Story
from .rank import pick_brief, rank_stories
from .sources import load_sources
from .store import Supabase, SupabaseCache, save_files, save_supabase
from .summarise import SummaryCache, summarise


def _log(msg: str) -> None:
    print(f"[kernel] {msg}", flush=True)


def story_to_dict(story: Story) -> dict:
    return {
        "headline": story.headline,
        "summary": story.summary,
        "why_it_matters": story.why_it_matters,
        "topic": story.topic,
        "score": round(story.score, 3),
        "importance": story.importance,
        "published": story.newest.isoformat(),
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

    stories = group_articles(fresh, llm, settings.embeddings, settings.data_dir / "models")
    multi = sum(1 for s in stories if len(s.sources) > 1)
    _log(f"grouped into {len(stories)} stories ({multi} covered by 2+ sources)")

    db = None
    if settings.supabase_url and settings.supabase_secret_key and not args.no_db:
        db = Supabase(settings.supabase_url, settings.supabase_secret_key)
    cache = SupabaseCache(db) if db else SummaryCache(settings.data_dir / "cache.sqlite3")

    ranked = rank_stories(stories, llm)
    brief = pick_brief(ranked, top)
    summarise(brief, llm, cache)

    today = datetime.now(settings.timezone).date().isoformat()
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
        },
        "stories": [story_to_dict(s) for s in brief],
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
        print(f"      [{story.topic}] {label}")
        if story.summary:
            print(f"      {story.summary}")
        if story.why_it_matters:
            print(f"      Why it matters: {story.why_it_matters}")
    print()
    _log(f"done in {time.time() - started:.0f}s -> {latest}")


if __name__ == "__main__":
    main()
