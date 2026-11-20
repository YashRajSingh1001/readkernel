import dataclasses
import json
from datetime import date
from pathlib import Path

import httpx
import pytest

from kernel import explain
from kernel.config import load_settings
from kernel.explain import Candidate, Skip, Step, approve, draft, page_text, pick_candidates, verify_steps
from kernel.store import Supabase

FIXTURES = Path(__file__).parent / "fixtures"
SIMON = page_text((FIXTURES / "simon_gpt62.html").read_text(encoding="utf-8"))
OPENAI = page_text((FIXTURES / "openai_gpt62.html").read_text(encoding="utf-8"))
EXPLAIN = {"OpenAI News", "Simon Willison"}


def kept(quotes: list[str], source: str) -> list[str]:
    steps = [Step(text="A step that says something.", quote=q) for q in quotes]
    return [s.quote for s in verify_steps(steps, source)]


def test_quote_check_keeps_real_quotes_from_real_html():
    real = [
        "We're deploying GPT-6.2 Astra and Sol with our strongest safeguards to date.",
        "GPT-6.2 Astra&#x27;s documents were a significant step up from GPT-6 Astra.",
        "strengthened the systems we use to monitor models and intervene when needed",
        "Anthropic reported Fable 5.2’s score of 74.6% at max reasoning",
    ]
    assert kept(real, OPENAI) == real


def test_quote_check_handles_curly_quotes_hyphens_and_inline_tags():
    real = [
        "We're introducing GPT-6.2 Astra, our new frontier model for your hardest projects",
        "“They’re available in the API as gpt-6.2-astra and gpt-6.2-sol.”",
        "I SHIPPED LLM 0.38 with support   for the new models.",
    ]
    assert kept(real, SIMON) == real


def test_quote_check_drops_altered_short_empty_and_hidden_quotes():
    assert kept([
        "6.2 Astra is 90% of the price of 6 Astra",
        "We're deploying GPT-6.2 Astra and Sol with our best safeguards to date.",
        "GPT-6.2 Sol",
        "",
        "   ",
        "We're shipping a secret third model today",
        "Simon Willison’s Weblog",
    ], SIMON + "\n" + OPENAI) == []


class FakeLLM:
    def __init__(self, reply):
        self.reply = reply

    def json(self, system, user, max_tokens=700):
        self.user = user
        return self.reply


def reply_with(quotes: list[str]) -> dict:
    return {
        "title": "How GPT-6.2 Astra and Sol work and how to try them",
        "what_it_is": "GPT-6.2 Astra and Sol are two new OpenAI models.",
        "steps": [{"text": f"Step number {i} explained.", "quote": q} for i, q in enumerate(quotes, 1)],
        "whats_new": "Astra costs 80% of 6 Astra.",
        "limits": "Its communication style can be confusing.",
        "try_it": "In the API as gpt-6.2-astra, $8/MTok input.",
    }


CANDIDATE = Candidate("549a77347d5e", "OpenAI launches GPT-6.2", "Simon Willison", "https://simonwillison.net/x/")
GOOD = [
    "They're available in the API as gpt-6.2-astra and gpt-6.2-sol.",
    "6.2 Astra is 80% of the price of 6 Astra",
    "The cached price is an even bigger discount",
]


def test_draft_drops_unsupported_steps_and_keeps_the_rest():
    llm = FakeLLM(reply_with(GOOD + ["Astra 6.2 beats every model on every benchmark."]))
    result, dropped = draft(CANDIDATE, SIMON, llm)
    assert dropped == 1
    assert [s.quote for s in result.steps] == GOOD
    assert "I shipped LLM 0.38" in llm.user


def test_draft_is_refused_when_fewer_than_three_quotes_survive():
    llm = FakeLLM(reply_with(GOOD[:2] + ["Made up quote that is not in the post."]))
    with pytest.raises(Skip):
        draft(CANDIDATE, SIMON, llm)


def story(key, score, *sources):
    return {"story_key": key, "headline": key.upper(), "score": score,
            "sources": [{"name": n, "url": u} for n, u in sources]}


def test_picks_highest_ranked_story_with_an_explain_source():
    stories = [
        story("verge-only", 9.0, ("The Verge", "https://verge.example/a")),
        story("openai", 7.0, ("The Verge", "https://verge.example/b"), ("OpenAI News", "https://openai.com/a")),
        story("simon", 8.0, ("Simon Willison", "https://simonwillison.net/a")),
    ]
    picked = pick_candidates(stories, EXPLAIN, [])
    assert [(c.story_key, c.source_url) for c in picked] == [
        ("simon", "https://simonwillison.net/a"),
        ("openai", "https://openai.com/a"),
    ]


def test_arxiv_links_count_from_any_source():
    stories = [story("paper", 5.0, ("Hacker News", "https://arxiv.org/abs/2611.01234"))]
    assert [c.source_url for c in pick_candidates(stories, EXPLAIN, [])] == ["https://arxiv.org/abs/2611.01234"]


def test_skips_stories_and_sources_that_already_have_an_explainer():
    stories = [
        story("done", 9.0, ("OpenAI News", "https://openai.com/a")),
        story("same-source", 8.0, ("Simon Willison", "https://simonwillison.net/used")),
        story("fresh", 7.0, ("Simon Willison", "https://simonwillison.net/new")),
    ]
    existing = [
        {"story_key": "done", "source_url": "https://openai.com/a"},
        {"story_key": "old", "source_url": "https://simonwillison.net/used"},
    ]
    assert [c.story_key for c in pick_candidates(stories, EXPLAIN, existing)] == ["fresh"]


def test_a_story_seen_on_several_days_is_one_candidate():
    stories = [
        story("gpt", 5.0, ("OpenAI News", "https://openai.com/a")),
        story("gpt", 8.0, ("OpenAI News", "https://openai.com/a")),
    ]
    assert len(pick_candidates(stories, EXPLAIN, [])) == 1


def test_no_qualifying_story_means_no_explainer(tmp_path):
    brief = {"feed": [story("verge", 9.0, ("The Verge", "https://verge.example/a"))]}
    (tmp_path / "brief-2026-11-20.json").write_text(json.dumps(brief), encoding="utf-8")
    settings = dataclasses.replace(load_settings(), data_dir=tmp_path)
    llm = FakeLLM(None)
    assert explain.run(settings, None, llm, date(2026, 11, 20)) is None
    assert not hasattr(llm, "user")


class RateLimitedLLM:
    def __init__(self, replies):
        self.replies = list(replies)

    def json(self, system, user, max_tokens=700):
        return self.replies.pop(0)


def two_candidates(tmp_path, monkeypatch):
    brief = {"feed": [
        story("top", 9.0, ("Simon Willison", "https://simonwillison.net/top")),
        story("lower", 5.0, ("OpenAI News", "https://openai.com/lower")),
    ]}
    (tmp_path / "brief-2026-11-20.json").write_text(json.dumps(brief), encoding="utf-8")
    fetched, waits = [], []
    monkeypatch.setattr(explain, "fetch_page", lambda client, url: fetched.append(url) or SIMON)
    monkeypatch.setattr(explain.time, "sleep", waits.append)
    return dataclasses.replace(load_settings(), data_dir=tmp_path), fetched, waits


def test_a_rate_limited_model_waits_and_keeps_the_top_story(tmp_path, monkeypatch):
    settings, fetched, waits = two_candidates(tmp_path, monkeypatch)
    llm = RateLimitedLLM([None, reply_with(GOOD)])
    row = explain.run(settings, None, llm, date(2026, 11, 20))
    assert row["story_key"] == "top" and row["status"] == "draft" and row["week_of"] == "2026-11-16"
    assert fetched == ["https://simonwillison.net/top"]
    assert waits == [explain.MODEL_RETRY_SECONDS]


def test_a_model_that_stays_silent_stops_the_run_instead_of_picking_a_lower_story(tmp_path, monkeypatch):
    settings, fetched, _ = two_candidates(tmp_path, monkeypatch)
    with pytest.raises(explain.ModelUnavailable):
        explain.run(settings, None, RateLimitedLLM([None, None]), date(2026, 11, 20))
    assert fetched == ["https://simonwillison.net/top"]


def test_review_email_reaches_the_team_with_the_approve_command(tmp_path):
    from email import message_from_bytes, policy

    from kernel.mailer import PreviewMailer

    result, _ = draft(CANDIDATE, SIMON, FakeLLM(reply_with(GOOD)))
    row = explain.to_row(CANDIDATE, result, "how-gpt-6-2-works", date(2026, 11, 16))
    PreviewMailer("ReadKernel <brief@r.example>", tmp_path).send(explain.review_email(row, "team@r.example"))
    parsed = message_from_bytes(next(tmp_path.glob("*.eml")).read_bytes(), policy=policy.default)
    assert parsed["To"] == "team@r.example"
    assert parsed["Subject"] == "Explainer draft to check: How GPT-6.2 Astra and Sol work and how to try them"
    text = parsed.get_body(("plain",)).get_content()
    assert "python -m kernel.explain --approve how-gpt-6-2-works" in text
    assert GOOD[0] in text


def fake_db(handler) -> tuple[Supabase, list[httpx.Request]]:
    seen: list[httpx.Request] = []

    def record(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return handler(request)

    db = Supabase("https://proj.supabase.co", "sb_secret_test")
    db.client = httpx.Client(transport=httpx.MockTransport(record), headers=db.client.headers)
    return db, seen


def test_a_second_run_in_the_same_week_does_nothing():
    row = {"slug": "how-x-works", "week_of": "2026-11-16", "story_key": "k", "source_url": "u", "status": "draft"}
    db, seen = fake_db(lambda r: httpx.Response(200, json=[row]))
    assert explain.run(load_settings(), db, FakeLLM(None), date(2026, 11, 20)) is None
    assert [r.url.path for r in seen] == ["/rest/v1/explainers"]


def test_approve_publishes_only_a_draft():
    db, seen = fake_db(lambda r: httpx.Response(200, json=[{"slug": "how-x-works"}]))
    assert approve(db, "how-x-works") == "approved"
    patch = seen[0]
    assert patch.method == "PATCH"
    assert dict(patch.url.params) == {"slug": "eq.how-x-works", "status": "eq.draft"}
    body = json.loads(patch.content)
    assert body["status"] == "approved" and body["approved_at"]


def test_slug_ends_on_a_whole_word_and_avoids_taken_slugs():
    title = "Introducing GPT‑6.2 Astra and Sol for professional and everyday work"
    assert explain.slug_for(title, date(2026, 11, 16), set()) == "introducing-gpt-6-2-astra-and-sol-for-professional-and"
    assert explain.slug_for("How Sol works", date(2026, 11, 16), {"how-sol-works"}) == "how-sol-works-2026-11-16"


def test_approve_unknown_slug_fails():
    db, _ = fake_db(lambda r: httpx.Response(200, json=[]))
    with pytest.raises(LookupError):
        approve(db, "nope")


def test_a_rejected_draft_frees_the_week_for_the_next_story(tmp_path, monkeypatch):
    settings, fetched, _ = two_candidates(tmp_path, monkeypatch)
    rejected = {"slug": "top-story", "week_of": "2026-11-16", "story_key": "top",
                "source_url": "https://simonwillison.net/top", "status": "rejected"}
    monkeypatch.setattr(explain, "load_existing", lambda db: [rejected])
    row = explain.run(settings, None, FakeLLM(reply_with(GOOD)), date(2026, 11, 20))
    assert row["story_key"] == "lower"
    assert fetched == ["https://openai.com/lower"]


def test_reject_touches_only_a_draft():
    db, seen = fake_db(lambda r: httpx.Response(200, json=[{"slug": "how-x-works"}]))
    explain.reject(db, "how-x-works")
    assert seen[0].method == "PATCH"
    assert dict(seen[0].url.params) == {"slug": "eq.how-x-works", "status": "eq.draft"}
    assert json.loads(seen[0].content) == {"status": "rejected"}
