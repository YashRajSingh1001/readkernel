import httpx
import pytest
from test_factcheck import FIX, MemoryCache, ScriptedLLM, story

from kernel.factcheck import check_key, fact_check
from kernel.llm import LLM, MAX_TRIES
from kernel.summarise import SummaryCache, summarise

PUBLISHER_SUMMARY = "Acme raised $5 million from Big Fund."


def assert_publisher_words(s, headline="Acme raises $5 million"):
    assert s.headline == headline
    assert s.summary == PUBLISHER_SUMMARY and s.why_it_matters == ""
    assert s.extra["fact_check"] == "fallback"


def test_no_reply_on_the_first_check_uses_the_publishers_words():
    s, cache = story(), MemoryCache()
    counts = fact_check([s], ScriptedLLM(None), cache)
    assert counts == {"ok": 0, "fixed": 0, "fallback": 1, "unchecked": 0}
    assert_publisher_words(s)
    assert "2024" not in s.summary
    assert cache == {}


def test_a_missing_id_only_affects_that_story():
    a, b, c = story(headline="Acme raises $5 million"), story(headline="Acme gets $5 million"), story(headline="Acme lands $5 million")
    cache = MemoryCache()
    reply = {"stories": {"s0": {"verdict": "ok"}, "s2": {"verdict": "ok"}}}
    counts = fact_check([a, b, c], ScriptedLLM(reply), cache)
    assert counts == {"ok": 2, "fixed": 0, "fallback": 1, "unchecked": 0}
    assert a.extra["fact_check"] == "ok" and c.extra["fact_check"] == "ok"
    assert "2024" in a.summary and "2024" in c.summary
    assert_publisher_words(b, headline="Acme gets $5 million")
    assert set(cache) == {check_key(story(headline="Acme raises $5 million")), check_key(story(headline="Acme lands $5 million"))}


def test_a_malformed_answer_counts_as_no_answer():
    s, cache = story(), MemoryCache()
    counts = fact_check([s], ScriptedLLM({"stories": {"s0": "ok"}}), cache)
    assert counts["fallback"] == 1 and counts["unchecked"] == 0
    assert_publisher_words(s)
    assert cache == {}


def test_a_failed_first_check_is_retried_on_the_next_run():
    cache = MemoryCache()
    fact_check([story()], ScriptedLLM(None), cache)
    again, llm = story(), ScriptedLLM({"stories": {"s0": {"verdict": "ok"}}})
    counts = fact_check([again], llm, cache)
    assert llm.calls == 1 and counts["ok"] == 1
    assert again.extra["fact_check"] == "ok" and "2024" in again.summary


@pytest.mark.parametrize("answer", [
    {}, {"verdict": "unknown"}, {"verdict": ["ok"]},
    {**FIX, "verdict": "unknown"}, {"verdict": "fix"},
    {**FIX, "summary": 123}, {**FIX, "problems": 123},
])
@pytest.mark.parametrize("rewritten", [False, True])
def test_malformed_entries_fall_back_without_caching(answer, rewritten):
    s, cache = story(), MemoryCache()
    replies = [{"stories": {"s0": answer}}]
    if rewritten:
        replies.insert(0, {"stories": {"s0": FIX}})
    llm = ScriptedLLM(*replies)
    counts = fact_check([s], llm, cache)
    assert counts == {"ok": 0, "fixed": 0, "fallback": 1, "unchecked": 0}
    assert_publisher_words(s)
    assert cache == {}
    assert llm.calls == (2 if rewritten else 1)


@pytest.mark.parametrize("reply", [{}, {"stories": None}, {"stories": []}, {"stories": {"s0": None}}])
def test_malformed_batch_replies_are_not_verdicts(reply):
    s, cache = story(), MemoryCache()
    assert fact_check([s], ScriptedLLM(reply), cache)["fallback"] == 1
    assert_publisher_words(s)
    assert cache == {}


@pytest.mark.parametrize("failure, expected_calls", [
    ("http400", 1), ("http503", MAX_TRIES), ("json", MAX_TRIES), ("transport", MAX_TRIES),
])
def test_llm_failures_use_uncached_publisher_text(monkeypatch, failure, expected_calls):
    monkeypatch.setattr("kernel.llm.time.sleep", lambda _: None)
    calls = []

    def respond(request):
        calls.append(request)
        if failure == "transport":
            raise httpx.ConnectError("offline", request=request)
        if failure.startswith("http"):
            return httpx.Response(int(failure[4:]))
        return httpx.Response(200, json={"choices": [{"message": {"content": "bad json"}}]})

    s, cache = story(), MemoryCache()
    llm = LLM("openai", "test-key", "test-model")
    llm._client.close()
    llm._client = httpx.Client(transport=httpx.MockTransport(respond))
    try:
        assert fact_check([s], llm, cache)["fallback"] == 1
    finally:
        llm._client.close()
    assert len(calls) == expected_calls
    assert_publisher_words(s)
    assert cache == {}


def test_partial_answers_in_multiple_batches_do_not_cross_story_ids():
    stories = [story(headline=f"Acme round {i}") for i in range(7)]
    cache = MemoryCache()
    llm = ScriptedLLM(
        {"stories": {"s0": {"verdict": "ok"}, "s4": {"verdict": "ok"}}},
        {"stories": {"s1": {"verdict": "ok"}}},
    )
    counts = fact_check(stories, llm, cache)
    assert counts == {"ok": 3, "fixed": 0, "fallback": 4, "unchecked": 0}
    assert [s.extra["fact_check"] for s in stories] == ["ok", "fallback", "fallback", "fallback", "ok", "fallback", "ok"]
    assert llm.calls == 2 and len(cache) == 3


def test_empty_publisher_description_never_keeps_ai_text():
    s, cache = story(text=""), MemoryCache()
    s.headline = "Unsupported AI headline"
    counts = fact_check([s], ScriptedLLM(None), cache)
    assert counts["fallback"] == 1
    assert s.headline == s.lead.title and s.summary == "" and s.why_it_matters == ""
    assert s.extra["fact_check"] == "fallback" and cache == {}


def test_checker_unavailable_replaces_an_existing_ai_summary():
    s, cache = story(), MemoryCache()
    counts = fact_check([s], None, cache)
    assert counts == {"ok": 0, "fixed": 0, "fallback": 1, "unchecked": 0}
    assert_publisher_words(s)
    assert cache == {}


def test_transient_failure_does_not_replace_the_cached_ai_draft(tmp_path):
    cache = SummaryCache(tmp_path / "cache.sqlite3")
    draft = {"headline": story().headline, "summary": story().summary, "why_it_matters": story().why_it_matters}
    first = story()
    llm = ScriptedLLM(draft, None)
    llm.provider, llm.model = "fake", "fake-model"
    summarise([first], llm, cache)
    fact_check([first], llm, cache)
    assert_publisher_words(first)

    again = story()
    recovered = ScriptedLLM({"stories": {"s0": {"verdict": "ok"}}})
    recovered.provider, recovered.model = llm.provider, llm.model
    summarise([again], recovered, cache)
    assert again.summary == draft["summary"]
    assert fact_check([again], recovered, cache)["ok"] == 1
    assert recovered.calls == 1
    assert cache.get(check_key(again))["outcome"] == "ok"
    cache.db.close()


def test_old_cached_fallbacks_are_checked_again(monkeypatch):
    s = story()
    with monkeypatch.context() as old:
        old.setattr("kernel.factcheck.CHECK_VERSION", 1)
        legacy_key = check_key(s)
    cache = MemoryCache({legacy_key: {"outcome": "fallback", "text": {
        "headline": s.lead.title, "summary": s.lead.description, "why_it_matters": "",
    }}})
    llm = ScriptedLLM({"stories": {"s0": {"verdict": "ok"}}})
    assert fact_check([s], llm, cache)["ok"] == 1
    assert llm.calls == 1 and "2024" in s.summary
