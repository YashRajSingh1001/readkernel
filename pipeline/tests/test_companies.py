from datetime import datetime, timezone

from kernel.companies import ground, slug
from kernel.models import Article, Story
from kernel.store import story_company_rows
from kernel.summarise import cache_key, summarise

NOW = datetime(2026, 11, 8, tzinfo=timezone.utc)


def story(title, text="", source="TechCrunch"):
    article = Article(url=f"https://news.example/{title}", title=title, description=text, source=source,
                      topic="ai", weight=1.0, published=NOW)
    return Story(articles=[article])


def test_slug_merges_spellings_of_one_company():
    assert slug("OpenAI") == slug("Open AI") == slug("OpenAI Inc.") == "openai"
    assert slug("Booking.com") == "booking-com"
    assert slug("Meta Platforms") == "meta"


def test_ground_keeps_only_names_the_articles_mention():
    s = story("OpenAI raises $11 billion", "Rival Anthropic is preparing an IPO.")
    assert ground(["OpenAI", "Anthropic", "Google"], s) == ["OpenAI", "Anthropic"]


def test_ground_drops_the_news_outlet_and_partial_words():
    s = story("Meta adds metadata tools, TechCrunch reports", "Metadata is now searchable.", source="TechCrunch")
    assert ground(["TechCrunch", "Meta"], s) == ["Meta"]
    s = story("New metadata standard announced")
    assert ground(["Meta"], s) == []


def test_ground_dedupes_and_caps():
    s = story("A, B, C, D and E team up with OpenAI", "OpenAI Inc. leads.")
    assert ground(["OpenAI", "OpenAI Inc.", "A", "B", "C", "D", "E"], s) == ["OpenAI", "A", "B", "C"]
    assert ground([None, 5, ""], s) == []


class FakeLLM:
    provider, model = "fake", "fake-model"

    def __init__(self, reply):
        self.reply = reply

    def json(self, system, user, max_tokens=700):
        assert "companies" in system
        return self.reply


class MemoryCache(dict):
    def put(self, key, body):
        self[key] = body


def test_summarise_sets_grounded_companies():
    s = story("Fireworks hires Meta's strategy chief as CFO", "Fireworks, an AI infrastructure startup, hired him.")
    reply = {"headline": "Fireworks hires a new CFO from Meta", "summary": "Fireworks, an AI startup, hired Meta's strategy chief as its CFO.",
             "why_it_matters": "It is growing fast.", "kind": "news", "companies": ["Fireworks", "Meta", "Nvidia"]}
    summarise([s], FakeLLM(reply), MemoryCache())
    assert s.companies == ["Fireworks", "Meta"]


def test_cached_summaries_without_companies_still_work():
    s = story("Fireworks hires a CFO", "Fireworks hired a CFO.")
    cache = MemoryCache({cache_key(s, "fake:fake-model"): {
        "headline": "Fireworks hires a CFO now", "summary": "Fireworks hired a CFO from a large company this week.",
        "why_it_matters": "", "kind": "news"}})
    summarise([s], FakeLLM(None), cache)
    assert s.headline == "Fireworks hires a CFO now" and s.companies == []


def test_story_companies_rows_are_slugged_and_deduped():
    output = {"date": "2026-11-08", "stories": [], "feed": [
        {"story_key": "abc123", "companies": ["OpenAI", "Open AI", "Anthropic"]},
        {"story_key": None, "companies": ["Ignored"]},
        {"story_key": "def456"},
    ]}
    rows = story_company_rows(output)
    assert [(r["story_key"], r["company"]) for r in rows] == [("abc123", "openai"), ("abc123", "anthropic")]
    assert {r["edition_date"] for r in rows} == {"2026-11-08"}
