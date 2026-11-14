import json
from datetime import datetime, timedelta, timezone

import numpy as np
import pytest

import kernel.group as group
from kernel.models import Article

NOW = datetime(2026, 11, 15, 9, 0, tzinfo=timezone.utc)

TITLES = {
    "A": "Alpha rocket lifts off from northern pad",
    "B": "Bravo bank reports quarterly earnings jump",
    "C": "Charlie court ruling delays merger review",
    "D": "Delta satellite enters distant orbit",
}


@pytest.fixture(params=["local", "simple"])
def backend(request):
    return request.param


def art(key: str) -> Article:
    return Article(
        url=f"https://example.com/{key}",
        title=TITLES[key],
        description="",
        source=f"src-{key}",
        topic="tech",
        weight=1.0,
        published=NOW - timedelta(hours=1),
    )


class FakeLLM:
    """Answers same-event questions by title pair; pairs not in `answers` get no answer."""

    def __init__(self, answers: dict[frozenset, object]):
        self.answers = answers
        self.asked: list[frozenset] = []
        self.batch_sizes: list[int] = []

    def json(self, system, user, max_tokens=700):
        pairs = json.loads(user)["pairs"]
        self.batch_sizes.append(len(pairs))
        out = {}
        for pid, pair in pairs.items():
            key = frozenset(_key(pair[side]["title"]) for side in ("a", "b"))
            self.asked.append(key)
            if key in self.answers:
                out[pid] = self.answers[key]
        return {"answers": out}


def _key(title: str) -> str:
    return next(k for k, t in TITLES.items() if t == title)


def run(monkeypatch, order: list[str], sims: dict[frozenset, float], answers, backend):
    target = np.eye(len(order))
    for x, kx in enumerate(order):
        for y, ky in enumerate(order):
            if x != y:
                target[x, y] = sims[frozenset((kx, ky))]
    vectors = np.linalg.cholesky(target)
    monkeypatch.setattr(group, "embed", lambda texts, requested, cache_dir: (vectors, backend))
    llm = FakeLLM(answers) if answers is not None else None
    stories = group.group_articles([art(k) for k in order], llm=llm, backend=backend)
    groups = sorted(sorted(_key(a.title) for a in s.articles) for s in stories)
    return groups, llm


def pair(x, y):
    return frozenset((x, y))


GREY = {
    "local": {pair("A", "C"): 0.85, pair("B", "C"): 0.84, pair("A", "B"): 0.80},
    "simple": {pair("A", "C"): 0.45, pair("B", "C"): 0.44, pair("A", "B"): 0.35},
}

SURE_CHAIN = {
    "local": {pair("A", "C"): 0.95, pair("B", "C"): 0.94, pair("A", "B"): 0.85},
    "simple": {pair("A", "C"): 0.70, pair("B", "C"): 0.68, pair("A", "B"): 0.40},
}


def test_ai_no_blocks_merge_through_grey_chain(monkeypatch, backend):
    answers = {pair("A", "C"): True, pair("B", "C"): True, pair("A", "B"): False}
    groups, llm = run(monkeypatch, ["A", "B", "C"], GREY[backend], answers, backend)
    assert pair("A", "B") in llm.asked
    assert groups == [["A", "C"], ["B"]]


def test_ai_no_wins_over_chain_of_sure_joins(monkeypatch, backend):
    answers = {pair("A", "B"): False}
    groups, llm = run(monkeypatch, ["A", "B", "C"], SURE_CHAIN[backend], answers, backend)
    assert llm.asked == [pair("A", "B")]
    assert groups == [["A", "C"], ["B"]]


def test_unanswered_pair_is_not_a_cannot_link(monkeypatch, backend):
    answers = {pair("A", "C"): True, pair("B", "C"): True}  # no answer for A-B
    groups, _ = run(monkeypatch, ["A", "B", "C"], GREY[backend], answers, backend)
    assert groups == [["A", "B", "C"]]


def test_unanswered_pair_does_not_split_sure_chain(monkeypatch, backend):
    groups, _ = run(monkeypatch, ["A", "B", "C"], SURE_CHAIN[backend], {}, backend)
    assert groups == [["A", "B", "C"]]


@pytest.mark.parametrize("order", [["A", "B", "C"], ["B", "C", "A"], ["C", "A", "B"], ["B", "A", "C"]])
@pytest.mark.parametrize("sims,answers", [
    (GREY, {pair("A", "C"): True, pair("B", "C"): True, pair("A", "B"): False}),
    (SURE_CHAIN, {pair("A", "B"): False}),
])
def test_distinct_scores_do_not_depend_on_article_order(monkeypatch, order, sims, answers, backend):
    groups, _ = run(monkeypatch, order, sims[backend], answers, backend)
    assert groups == [["A", "C"], ["B"]]


def test_ai_no_blocks_join_between_existing_groups(monkeypatch, backend):
    floor = group.THRESHOLDS[backend].maybe
    sims = {
        pair("A", "B"): floor + 0.10,
        pair("C", "D"): floor + 0.09,
        pair("A", "C"): floor + 0.08,
        pair("A", "D"): floor + 0.04,
        pair("B", "C"): floor + 0.03,
        pair("B", "D"): floor + 0.02,
    }
    answers = {pair("A", "B"): True, pair("C", "D"): True,
               pair("A", "C"): True, pair("B", "D"): False}
    groups, _ = run(monkeypatch, ["A", "B", "C", "D"], sims, answers, backend)
    assert groups == [["A", "B"], ["C", "D"]]


@pytest.mark.parametrize("reply,expected", [
    (None, ([], [], [(0, 1)])),
    ({}, ([], [], [(0, 1)])),
    ({"answers": None}, ([], [], [(0, 1)])),
    ({"answers": []}, ([], [], [(0, 1)])),
    ({"answers": "false"}, ([], [], [(0, 1)])),
    ({"answers": {"p0": None}}, ([], [], [(0, 1)])),
    ({"answers": {"p0": "false"}}, ([], [], [(0, 1)])),
    ({"answers": {"p0": "true"}}, ([], [], [(0, 1)])),
    ({"answers": {"p0": 0}}, ([], [], [(0, 1)])),
    ({"answers": {"p0": 1}}, ([], [], [(0, 1)])),
    ({"answers": {"p0": False}}, ([], [(0, 1)], [])),
    ({"answers": {"p0": True}}, ([(0, 1)], [], [])),
])
def test_only_boolean_answers_are_verdicts(reply, expected):
    class ReplyLLM:
        def json(self, system, user):
            return reply

    assert group._ask_same_event([art("A"), art("B")], [(0, 1)], ReplyLLM()) == expected


@pytest.mark.parametrize("answers,expected", [
    ({pair("A", "B"): False}, [["A", "C"], ["B"]]),
    ({}, [["A", "B", "C"]]),
    (None, [["A", "B", "C"]]),
])
def test_rare_term_joins_respect_ai_no(monkeypatch, backend, answers, expected):
    for key in ("A", "B", "C"):
        monkeypatch.setitem(TITLES, key, TITLES[key] + " quasar nebula")
    articles = [art(k) for k in ("A", "B", "C")]
    assert group._shared_rare_terms(articles, [(0, 1), (0, 2), (1, 2)]) == [(0, 1), (0, 2), (1, 2)]
    groups, _ = run(monkeypatch, ["A", "B", "C"], GREY[backend], answers, backend)
    assert groups == expected


def test_pair_budget_keeps_unasked_pairs_eligible_for_fallback(monkeypatch, backend):
    order = [f"article{i}" for i in range(14)]
    for key in order:
        monkeypatch.setitem(TITLES, key, key)
    for key in order[-2:]:
        monkeypatch.setitem(TITLES, key, TITLES[key] + " quasar nebula")
    floor = group.THRESHOLDS[backend].maybe
    sims = {pair(a, b): floor + 0.04 for i, a in enumerate(order) for b in order[i + 1:]}
    unasked = pair(*order[-2:])
    sims[unasked] = floor + 0.02
    groups, llm = run(monkeypatch, order, sims, {p: False for p in sims}, backend)
    assert len(llm.asked) == len(set(llm.asked)) == group.MAX_AI_PAIRS == 80
    assert llm.batch_sizes == [15, 15, 15, 15, 15, 5]
    assert unasked not in llm.asked
    assert sorted(order[-2:]) in groups
    assert len(groups) == 13
    assert all(not (rejected <= set(members)) for rejected in llm.asked for members in groups)


@pytest.mark.parametrize("order,expected", [
    (["A", "B", "C"], [["A", "C"], ["B"]]),
    (["B", "A", "C"], [["A"], ["B", "C"]]),
])
def test_equal_scores_follow_input_pair_order(monkeypatch, backend, order, expected):
    vectors = np.zeros((3, 5))
    vectors[:, :2] = [0.75, 0.5] if backend == "local" else [0.5, 0.5]
    vectors[:, 2:] = np.eye(3) * np.sqrt(1 - (vectors[0, :2] ** 2).sum())
    monkeypatch.setattr(group, "embed", lambda texts, requested, cache_dir: (vectors, backend))
    answers = {pair("A", "C"): True, pair("B", "C"): True, pair("A", "B"): False}
    llm = FakeLLM(answers)
    stories = group.group_articles([art(k) for k in order], llm=llm, backend=backend)
    assert llm.asked == [pair(order[0], order[1]), pair(order[0], order[2]), pair(order[1], order[2])]
    assert sorted(sorted(_key(a.title) for a in s.articles) for s in stories) == expected


def test_similarity_floor_still_blocks_sure_chain(monkeypatch, backend):
    limits = group.THRESHOLDS[backend]
    sims = {pair("A", "C"): limits.sure + 0.02,
            pair("B", "C"): limits.sure + 0.01,
            pair("A", "B"): limits.maybe - 0.01}
    groups, _ = run(monkeypatch, ["A", "B", "C"], sims, None, backend)
    assert groups == [["A", "C"], ["B"]]
