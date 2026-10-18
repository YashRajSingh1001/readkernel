from datetime import datetime, timezone

import numpy as np

from kernel.discussions import parse_hn_feed
from kernel.fetch import entry_image
from kernel.images import page_preview_image
from kernel.models import Article, Story
from kernel.personal import select_stories, weekly_stories
from kernel.summarise import guess_kind
from kernel.telegram import build_message
from kernel.threads import assign_threads, story_key

NOW = datetime(2026, 10, 18, tzinfo=timezone.utc)


def art(title, url="https://x.com/a", topic="ai", desc=""):
    return Article(url=url, title=title, description=desc, source="S", topic=topic, weight=1.0, published=NOW)


def row(key, topic, score, brief=None, thread=None):
    return {"story_key": key, "headline": key, "topic": topic, "score": score, "brief_position": brief, "thread_id": thread}


def test_entry_image_prefers_media_and_skips_pixels():
    entry = {"media_content": [{"url": "https://cdn.x/pixel.gif"}, {"url": "https://cdn.x/photo.jpg", "medium": "image"}]}
    assert entry_image(entry) == "https://cdn.x/photo.jpg"
    entry = {"summary": '<p><img src="https://cdn.x/inline.png"></p>'}
    assert entry_image(entry) == "https://cdn.x/inline.png"
    assert entry_image({"summary": "no image"}) == ""


def test_page_preview_image_reads_og_tags_and_resolves_relative():
    page = '<head><meta property="og:image" content="/img/share.jpg"></head>'
    assert page_preview_image(page, "https://site.com/post/1") == "https://site.com/img/share.jpg"
    page = "<meta name='twitter:image' content='https://cdn.site.com/t.png'>"
    assert page_preview_image(page, "https://site.com/") == "https://cdn.site.com/t.png"
    assert page_preview_image("<html></html>", "https://site.com/") == ""


def test_select_stories_follows_brief_or_topics():
    brief = [row("b1", "ai", 9, 1), row("b2", "tech", 8, 2)]
    feed = brief + [row("f1", "dev", 7), row("f2", "ai", 6), row("f3", "markets", 5)]
    assert [s["story_key"] for s in select_stories(brief, feed, [], 5)][:2] == ["b1", "b2"]
    assert len(select_stories(brief, feed, [], 5)) == 5  # topped up from the feed
    assert [s["story_key"] for s in select_stories(brief, feed, ["ai"], 10)] == ["b1", "f2"]


def test_weekly_keeps_one_story_per_thread():
    rows = [row("a", "ai", 5, thread="t1"), row("b", "ai", 9, thread="t1"), row("c", "dev", 7, thread="t2")]
    assert [s["story_key"] for s in weekly_stories(rows, 10)] == ["b", "c"]


def test_threads_link_same_story_across_days():
    today = [Story([art("OpenAI ships new GPT model to all users", "https://n.com/1")])]
    today[0].headline = "OpenAI ships new GPT model to all users"
    previous = [
        {"story_key": "old1", "thread_id": "th-gpt", "headline": "OpenAI ships new GPT model to all users", "summary": ""},
        {"story_key": "old2", "thread_id": "", "headline": "City approves bike lanes", "summary": ""},
    ]
    assert assign_threads(today, previous, backend="simple") == 1
    assert today[0].thread_id == "th-gpt"
    fresh = [Story([art("Totally unrelated volcano news", "https://n.com/2")])]
    assign_threads(fresh, previous, backend="simple")
    assert fresh[0].thread_id == story_key(fresh[0])


def test_guess_kind_spots_model_releases():
    assert guess_kind(Story([art("Meta releases open-weights Llama 5 model")])) == "model_release"
    assert guess_kind(Story([art("Meta releases quarterly earnings", topic="markets")])) == "news"


def test_hn_feed_parsing_reads_points_and_comments():
    rss = b"""<?xml version="1.0"?><rss version="2.0"><channel><item><title>Show HN: Tiny DB</title>
    <link>https://tiny.db</link><comments>https://news.ycombinator.com/item?id=1</comments>
    <pubDate>Sun, 18 Oct 2026 01:00:00 GMT</pubDate>
    <description><![CDATA[<p>Points: 321</p><p># Comments: 45</p>]]></description></item></channel></rss>"""
    [d] = parse_hn_feed(rss, "Show HN")
    assert (d.title, d.points, d.comments) == ("Tiny DB", 321, 45)


def test_telegram_message_links_story_pages():
    edition = {"date": "2026-10-18", "stories": [{"story_key": "abc123def456", "headline": "A & B", "topic": "ai", "sources": []}]}
    text = build_message(edition, "https://r.example")
    assert 'href="https://r.example/story/abc123def456"' in text and "A &amp; B" in text


def test_algolia_hits_become_discussions():
    from kernel.discussions import _first_sentence, parse_algolia

    data = {"hits": [
        {"title": "Show HN: Tiny DB", "url": "https://tiny.db", "points": 120, "num_comments": 30, "objectID": "9", "created_at_i": 1792300000},
        {"title": "Ask HN: no link", "url": None, "points": 80, "num_comments": 5, "objectID": "10", "created_at_i": 1792300000},
        {"title": "Too small", "url": "https://x", "points": 3, "num_comments": 0, "objectID": "11", "created_at_i": 1792300000},
    ]}
    items = parse_algolia(data, "Show HN")
    assert [(d.title, d.points) for d in items] == [("Tiny DB", 120), ("Ask HN: no link", 80)]
    assert items[1].url == "https://news.ycombinator.com/item?id=10"
    assert _first_sentence("Surging U.S. gold exports topped oil. Second sentence.") == "Surging U.S. gold exports topped oil."
