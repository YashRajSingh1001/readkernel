from datetime import datetime, timedelta, timezone

from kernel.config import PIPELINE_DIR
from kernel.fetch import clean_description, clean_text, parse_feed
from kernel.filter import canonical_url, filter_articles
from kernel.group import _shared_rare_terms, group_articles
from kernel.llm import parse_json_object
from kernel.models import Article, Source, Story
from kernel.rank import pick_brief, rank_stories
from kernel.sources import load_sources
from kernel.summarise import fallback_summary

NOW = datetime(2026, 10, 18, 9, 0, tzinfo=timezone.utc)


def art(title, source="A", hours_ago=1, topic="tech", weight=1.0, url=None, desc=""):
    return Article(
        url=url or f"https://example.com/{source}/{abs(hash(title))}",
        title=title,
        description=desc,
        source=source,
        topic=topic,
        weight=weight,
        published=NOW - timedelta(hours=hours_ago),
    )


def test_sources_file_is_valid():
    sources, exclude = load_sources(PIPELINE_DIR / "sources.yaml")
    assert len(sources) >= 25
    assert "best deals" in exclude and "deal" not in exclude
    assert "deals" not in exclude


def test_clean_text_strips_html():
    assert clean_text("<p>Hello&nbsp;<b>world</b></p>") == "Hello world"


def test_parse_feed_reads_rss():
    rss = b"""<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>
      <item><title>Chip maker ships new GPU</title><link>https://x.com/a</link>
      <description>&lt;p&gt;Details here.&lt;/p&gt;</description>
      <pubDate>Sat, 18 Oct 2026 07:00:00 GMT</pubDate></item>
      <item><title>No date, skipped</title><link>https://x.com/b</link></item>
    </channel></rss>"""
    articles = parse_feed(rss, Source("X", "https://x.com/feed", "tech"))
    assert len(articles) == 1
    assert articles[0].description == "Details here."


def test_canonical_url_drops_tracking():
    a = canonical_url("http://www.Site.com/post/?utm_source=x&id=3#top")
    b = canonical_url("https://site.com/post?id=3")
    assert a == b


def test_filter_drops_old_junk_and_dupes():
    sources = [Source("A", "u1", "tech", exclude=("review",)), Source("B", "u2", "tech")]
    articles = [
        art("Fresh story", "A"),
        art("Old story", "A", hours_ago=50),
        art("Best laptop deals today", "B"),
        art("Phone review: great", "A"),
        art("Fresh story", "B"),
    ]
    kept = filter_articles(articles, sources, ["deals"], max_age_hours=36, now=NOW)
    assert [a.title for a in kept] == ["Fresh story"]


def test_grouping_merges_same_event_and_keeps_others_apart():
    articles = [
        art("Nvidia agrees to buy chip startup Groqqa for $5 billion", "A",
            desc="Nvidia will acquire Groqqa, a chip startup, for five billion dollars."),
        art("Nvidia to acquire Groqqa chip startup in $5 billion deal", "B",
            desc="Chip giant Nvidia is buying startup Groqqa for $5 billion."),
        art("City council approves new bike lanes downtown", "C",
            desc="Local council voted for more cycling lanes."),
    ]
    stories = group_articles(articles, llm=None, backend="simple")
    sizes = sorted(len(s.articles) for s in stories)
    assert sizes == [1, 2]


def test_ranking_prefers_wide_coverage_and_varies_topics():
    big = Story([art("Big", "A"), art("Big too", "B"), art("Big three", "C")])
    small = Story([art("Small", "D", hours_ago=20)])
    ranked = rank_stories([small, big], now=NOW)
    assert ranked[0] is big

    ai_stories = [Story([art(f"AI {i}", topic="ai")]) for i in range(5)]
    dev_story = Story([art("Dev", topic="dev", hours_ago=30)])
    ranked = rank_stories(ai_stories + [dev_story], now=NOW)
    brief = pick_brief(ranked, count=4, per_topic=3)
    assert dev_story in brief


def test_clean_description_drops_feed_boilerplate():
    assert clean_description("Article URL: https://x.com Comments URL: https://y Points: 5") == ""
    assert clean_description("Drupal patched two bugs. [...]") == "Drupal patched two bugs."
    assert clean_description("Big news. The post Big news appeared first on Site.") == "Big news."


def test_no_ai_grey_zone_needs_shared_rare_terms():
    articles = [
        art("Enterprise AI Startup RapidCanvas Nets $29 Mn To Expand", "Inc42"),
        art("AI execution company RapidCanvas raises $29M in Series B", "YourStory"),
        art("Some unrelated thing about phones", "Other"),
    ]
    assert _shared_rare_terms(articles, [(0, 1), (0, 2)]) == [(0, 1)]
    same_source = [art("RapidCanvas raises $29M", "A"), art("RapidCanvas $29M round", "A")]
    assert _shared_rare_terms(same_source, [(0, 1)]) == []


def test_fallback_summary_uses_first_sentences():
    story = Story([art("Title", desc="One. Two. Three.")])
    assert fallback_summary(story)["summary"] == "One. Two."


def test_parse_json_object_handles_fences():
    assert parse_json_object('```json\n{"a": 1}\n```') == {"a": 1}
    assert parse_json_object('Sure! {"a": 2} hope that helps') == {"a": 2}


def test_feed_keeps_brief_caps_topics_and_sorts_by_score():
    from kernel.rank import pick_feed

    stories = [Story([art(f"S{i}", topic="ai" if i < 6 else "dev")]) for i in range(10)]
    for i, s in enumerate(stories):
        s.score = 100 - i
    brief = [stories[9]]
    feed = pick_feed(stories, brief, size=6, per_topic=3)
    assert stories[9] in feed
    assert sum(1 for s in feed if s.topic == "ai") <= 3
    assert [s.score for s in feed] == sorted((s.score for s in feed), reverse=True)
    assert len(feed) == 6


def test_story_key_is_stable_across_tracking_params():
    from kernel.run import story_key

    a = Story([art("X", url="https://site.com/post?utm_source=rss")])
    b = Story([art("X", url="http://www.site.com/post/")])
    assert story_key(a) == story_key(b)
    assert len(story_key(a)) == 12
