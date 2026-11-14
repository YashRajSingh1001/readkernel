from test_factcheck import MemoryCache, ScriptedLLM, story

from kernel.factcheck import check_key, fact_check

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
