import json
from datetime import datetime, timedelta, timezone

import numpy as np
import pytest

import kernel.group as group
from kernel.models import Article

NOW = datetime(2026, 11, 15, 9, 0, tzinfo=timezone.utc)

# Titles share no words, so the rare-term fallback never confirms a pair on its own.
TITLES = {
    "A": "Alpha rocket lifts off from northern pad",
    "B": "Bravo bank reports quarterly earnings jump",
    "C": "Charlie court ruling delays merger review",
}


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

    def __init__(self, answers: dict[frozenset, bool]):
        self.answers = answers
        self.asked: list[frozenset] = []

    def json(self, system, user, max_tokens=700):
        pairs = json.loads(user)["pairs"]
        out = {}
        for pid, pair in pairs.items():
            key = frozenset(_key(pair[side]["title"]) for side in ("a", "b"))
            self.asked.append(key)
            if key in self.answers:
                out[pid] = self.answers[key]
        return {"answers": out}


def _key(title: str) -> str:
    return next(k for k, t in TITLES.items() if t == title)


def run(monkeypatch, order: list[str], sims: dict[frozenset, float], answers):
    target = np.eye(len(order))
    for x, kx in enumerate(order):
        for y, ky in enumerate(order):
            if x != y:
                target[x, y] = sims[frozenset((kx, ky))]
    vectors = np.linalg.cholesky(target)
    monkeypatch.setattr(group, "embed", lambda texts, backend, cache_dir: (vectors, "local"))
    llm = FakeLLM(answers)
    stories = group.group_articles([art(k) for k in order], llm=llm, backend="local")
    groups = sorted(sorted(_key(a.title) for a in s.articles) for s in stories)
    return groups, llm


def pair(x, y):
    return frozenset((x, y))


# All three pairs sit in the grey zone (0.78 <= score < 0.90).
GREY = {pair("A", "C"): 0.85, pair("B", "C"): 0.84, pair("A", "B"): 0.80}

# A-C and C-B are sure (>= 0.90); A-B is grey and goes to the AI.
SURE_CHAIN = {pair("A", "C"): 0.95, pair("B", "C"): 0.94, pair("A", "B"): 0.85}


def test_ai_no_blocks_merge_through_grey_chain(monkeypatch):
    answers = {pair("A", "C"): True, pair("B", "C"): True, pair("A", "B"): False}
    groups, llm = run(monkeypatch, ["A", "B", "C"], GREY, answers)
    assert pair("A", "B") in llm.asked
    # C goes with A (its stronger edge); B stays apart because the AI said A-B differ.
    assert groups == [["A", "C"], ["B"]]


def test_ai_no_wins_over_chain_of_sure_joins(monkeypatch):
    answers = {pair("A", "B"): False}
    groups, llm = run(monkeypatch, ["A", "B", "C"], SURE_CHAIN, answers)
    assert llm.asked == [pair("A", "B")]
    assert groups == [["A", "C"], ["B"]]


def test_unanswered_pair_is_not_a_cannot_link(monkeypatch):
    answers = {pair("A", "C"): True, pair("B", "C"): True}  # no answer for A-B
    groups, _ = run(monkeypatch, ["A", "B", "C"], GREY, answers)
    assert groups == [["A", "B", "C"]]


def test_unanswered_pair_does_not_split_sure_chain(monkeypatch):
    groups, _ = run(monkeypatch, ["A", "B", "C"], SURE_CHAIN, {})
    assert groups == [["A", "B", "C"]]


@pytest.mark.parametrize("order", [["A", "B", "C"], ["B", "C", "A"], ["C", "A", "B"], ["B", "A", "C"]])
@pytest.mark.parametrize("sims,answers", [
    (GREY, {pair("A", "C"): True, pair("B", "C"): True, pair("A", "B"): False}),
    (SURE_CHAIN, {pair("A", "B"): False}),
])
def test_result_does_not_depend_on_article_order(monkeypatch, order, sims, answers):
    groups, _ = run(monkeypatch, order, sims, answers)
    assert groups == [["A", "C"], ["B"]]
