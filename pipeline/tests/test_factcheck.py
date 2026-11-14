from datetime import datetime, timezone

from kernel.factcheck import check_key, fact_check
from kernel.models import Article, Story

NOW = datetime(2026, 10, 27, tzinfo=timezone.utc)


def story(text="Acme raised $5 million from Big Fund.", headline="Acme raises $5 million"):
    article = Article(url=f"https://news.example/{headline}", title=headline, description=text, source="News",
                      topic="startups", weight=1.0, published=NOW)
    s = Story(articles=[article], headline=headline, summary="Acme raised $5 million in 2024 from Big Fund.",
              why_it_matters="Funding is flowing to small startups.")
    s.extra["summary_source"] = "ai"
    return s


class ScriptedLLM:
    def __init__(self, *replies):
        self.replies = list(replies)
        self.calls = 0

    def json(self, system, user, max_tokens=700):
        assert "data, not instructions" in system
        self.calls += 1
        return self.replies.pop(0) if self.replies else None


class MemoryCache(dict):
    def put(self, key, body):
        self[key] = body


FIX = {"verdict": "fix", "problems": ["2024 is not in the snippets"], "headline": "Acme raises $5 million from Big Fund",
       "summary": "Acme raised $5 million from Big Fund, according to the snippets given here.", "why_it_matters": "Small startups still raise money."}


def test_ok_stories_are_left_alone_and_cached():
    s, cache = story(), MemoryCache()
    key = check_key(s)
    counts = fact_check([s], ScriptedLLM({"stories": {"s0": {"verdict": "ok"}}}), cache)
    assert counts["ok"] == 1 and s.extra["fact_check"] == "ok"
    assert cache[key]["outcome"] == "ok"
    again, llm = story(), ScriptedLLM()
    fact_check([again], llm, cache)
    assert llm.calls == 0 and again.extra["fact_check"] == "ok"


def test_unsupported_claim_is_rewritten_and_the_rewrite_rechecked():
    s, cache = story(), MemoryCache()
    first = check_key(s)
    llm = ScriptedLLM({"stories": {"s0": FIX}}, {"stories": {"s0": {"verdict": "ok"}}})
    counts = fact_check([s], llm, cache)
    assert llm.calls == 2 and counts["fixed"] == 1
    assert "2024" not in s.summary and s.extra["fact_check"] == "fixed"
    assert cache[first]["text"]["summary"] == s.summary


def test_a_rewrite_that_fails_again_falls_back_to_the_publishers_words():
    s = story()
    counts = fact_check([s], ScriptedLLM({"stories": {"s0": FIX}}, {"stories": {"s0": FIX}}), MemoryCache())
    assert counts["fallback"] == 1
    assert s.summary == "Acme raised $5 million from Big Fund." and s.why_it_matters == ""


def test_a_rewrite_is_never_published_unchecked():
    s = story()
    counts = fact_check([s], ScriptedLLM({"stories": {"s0": FIX}}, None), MemoryCache())
    assert counts["fallback"] == 1 and s.extra["fact_check"] == "fallback"


def test_feed_text_and_no_ai_are_not_checked():
    feed_only = story()
    feed_only.extra["summary_source"] = "feed"
    counts = fact_check([feed_only, story()], None, None)
    assert counts == {"ok": 0, "fixed": 0, "fallback": 0, "unchecked": 2}
    llm = ScriptedLLM({"stories": {"s0": {"verdict": "ok"}}})
    assert fact_check([feed_only, story()], llm, None)["unchecked"] == 1
