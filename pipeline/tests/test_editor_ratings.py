import math
from datetime import datetime, timedelta, timezone

import pytest

from kernel.models import Article, Story
from kernel.rank import base_score, pick_brief, pick_feed, rank_stories

NOW = datetime(2026, 10, 18, 9, 0, tzinfo=timezone.utc)


def story(n):
    article = Article(
        url=f"https://example.com/{n}",
        title=f"Story {n}",
        description="",
        source=f"S{n}",
        topic="tech",
        weight=1.0,
        published=NOW - timedelta(hours=n + 1),
    )
    return Story(articles=[article])


class FakeLLM:
    def __init__(self, reply=None, error=None):
        self.reply = reply
        self.error = error

    def json(self, system, user, max_tokens=700):
        if self.error:
            raise self.error
        return self.reply


def rank_with(reply=None, error=None, count=2):
    stories = [story(n) for n in range(count)]
    base = {id(s): base_score(s, NOW) for s in stories}
    ranked = rank_stories(stories, FakeLLM(reply, error), now=NOW)
    return stories, base, ranked


def assert_base_ranking(stories, base, ranked):
    assert ranked == stories
    for s in stories:
        assert s.importance is None
        assert s.score == base[id(s)]


@pytest.mark.parametrize(
    "reply",
    [
        None,
        [],
        [{"ratings": {"s0": 1}}],
        "ratings",
        {},
        {"ratings": None},
        {"ratings": []},
        {"ratings": [1, 1]},
        {"ratings": "s0: 1"},
        {"other": {"s0": 1}},
    ],
    ids=["reply-none", "reply-empty-list", "reply-list", "reply-string", "ratings-missing",
         "ratings-null", "ratings-empty-list", "ratings-list", "ratings-string", "ratings-wrong-key"],
)
def test_malformed_reply_keeps_base_ranking(reply):
    stories, base, ranked = rank_with(reply)
    assert_base_ranking(stories, base, ranked)


@pytest.mark.parametrize(
    "value",
    [True, False, 1.5, 2.5, 0.9, "4", "1", 0, 6, -1, math.nan, math.inf, -math.inf, None, [4], {"v": 4}],
)
def test_invalid_rating_is_ignored(value):
    stories, base, ranked = rank_with({"ratings": {"s0": value}})
    assert stories[0].importance is None
    assert stories[0].score == base[id(stories[0])]


def test_invalid_rating_never_vetoes_story():
    stories, _, ranked = rank_with({"ratings": {"s0": True, "s1": 1.5}})
    brief = pick_brief(ranked, count=2)
    assert set(map(id, brief)) == set(map(id, stories))
    assert set(map(id, pick_feed(ranked, [], size=2))) == set(map(id, stories))


@pytest.mark.parametrize("value, expected", [(1, 1), (3, 3), (5, 5), (4.0, 4), (1.0, 1)])
def test_valid_rating_is_applied(value, expected):
    stories, base, _ = rank_with({"ratings": {"s0": value}})
    assert stories[0].importance == expected
    assert type(stories[0].importance) is int
    assert stories[0].score == pytest.approx(base[id(stories[0])] + 0.9 * (expected - 3))


def test_valid_ratings_reorder_and_veto():
    stories, _, ranked = rank_with({"ratings": {"s0": 1, "s1": 5}})
    assert ranked[0] is stories[1]
    assert pick_brief(ranked, count=2) == [stories[1]]
    assert pick_feed(ranked, [], size=2) == [stories[1]]


def test_good_ratings_apply_when_others_are_bad():
    stories, base, _ = rank_with({"ratings": {"s0": "x", "s1": 4}})
    assert stories[0].importance is None
    assert stories[0].score == base[id(stories[0])]
    assert stories[1].importance == 4


@pytest.mark.parametrize("error", [RuntimeError("boom"), KeyError("choices"), TypeError("bad")])
def test_editor_exception_keeps_base_ranking(error, capsys):
    stories, base, ranked = rank_with(error=error)
    assert_base_ranking(stories, base, ranked)
    assert "editor failed" in capsys.readouterr().out


@pytest.mark.parametrize(
    "editor",
    [
        None,
        FakeLLM(None),
        FakeLLM({"ratings": [1, 5]}),
        FakeLLM({"ratings": {"s0": True, "s1": 1.5}}),
        FakeLLM(error=RuntimeError("boom")),
    ],
    ids=["no-editor", "no-reply", "malformed-ratings", "invalid-values", "editor-error"],
)
def test_reranking_clears_previous_ratings_on_fallback(editor):
    stories, base, _ = rank_with({"ratings": {"s0": 1, "s1": 5}})

    ranked = rank_stories(stories, editor, now=NOW)

    assert_base_ranking(stories, base, ranked)
    assert pick_brief(ranked, count=2) == stories
    assert pick_feed(ranked, [], size=2) == stories


def test_non_dict_ratings_are_logged(capsys):
    rank_with({"ratings": [1, 1]})
    assert "not an object" in capsys.readouterr().out


def test_errors_outside_editor_still_raise():
    bad = Story(articles=[])
    with pytest.raises(ValueError):
        rank_stories([bad], FakeLLM({"ratings": {}}), now=NOW)
