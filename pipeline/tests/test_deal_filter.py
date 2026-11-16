from datetime import datetime, timedelta, timezone

import pytest

from kernel.config import PIPELINE_DIR
from kernel.filter import _has_word, filter_articles
from kernel.models import Article
from kernel.sources import load_sources

NOW = datetime(2026, 11, 15, 9, 0, tzinfo=timezone.utc)
SOURCES, GLOBAL_EXCLUDE = load_sources(PIPELINE_DIR / "sources.yaml")


def kept(title, source):
    article = Article(
        url="https://example.com/story",
        title=title,
        description="",
        source=source,
        topic="tech",
        weight=1.0,
        published=NOW - timedelta(hours=1),
    )
    return bool(filter_articles([article], SOURCES, GLOBAL_EXCLUDE, max_age_hours=36, now=NOW))


def test_sources_used_here_exist():
    names = {s.name for s in SOURCES}
    assert {"TechCrunch", "Bloomberg Technology", "CNET", "9to5Google"} <= names


@pytest.mark.parametrize(
    "title",
    [
        "Microsoft signs $10B AI deal",
        "Adobe's Figma deal collapses",
        "EU approves Broadcom-VMware deal",
        "Activision deal: what happens next for Xbox",
        "OpenAI signs chip deals with AMD and Broadcom",
        "Nvidia strikes licensing deal with Groq",
        "Microsoft signs $10B AI DEAL",
        "Adobe’s Figma deal collapses",
        "EU approves Broadcom–VMware deal",
        "Google signs app deals with Android developers",
        "Google app deals: what the antitrust ruling means",
        "Apple shares trade 30% off their peak",
        "Arm deal values shares 30% off the previous offer",
    ],
)
@pytest.mark.parametrize("source", ["TechCrunch", "Bloomberg Technology"])
def test_deal_news_passes(title, source):
    assert kept(title, source)


@pytest.mark.parametrize(
    "title",
    [
        "Best Black Friday deals on AirPods",
        "Deal: 40% off Kindle",
        "Deal: AirPods Pro for $169",
        "DEALS: AirPods Pro, Kindle and more",
        "Deal: Get 40%-off Kindle today",
        "App deals: Save on a password manager",
        "  Deals\u00a0: AirPods Pro for $169",
        "Deal alerts: AirPods Pro for $169",
        "Today's best deals",
        "Today’s best deals",
        "Today's deals: Pixel 10, Galaxy Buds",
        "Today’s deals: Pixel 10, Galaxy Buds",
        "Today’s best Android game and app deals",
        "Cyber Monday: Kindle Paperwhite drops to $99",
        "Deal of the day: Anker power bank",
    ],
)
@pytest.mark.parametrize("source", ["TechCrunch", "9to5Google"])
def test_shopping_posts_dropped_without_per_source_exclude(title, source):
    assert not kept(title, source)


@pytest.mark.parametrize("source", ["CNET", "Gizmodo", "Tom's Hardware", "ZDNET"])
def test_source_excludes_still_drop_plural_and_singular_deal(source):
    assert not kept("Grab these deals before they're gone", source)
    assert not kept("AirPods Pro deal ends tonight", source)
    assert not kept("Microsoft signs $10B AI deal", source)


def test_has_word_does_not_match_plural():
    assert not _has_word("Grab these deals", ["deal"])
    assert _has_word("Grab these deals", ["deals"])


def test_phrase_symbols_are_literal():
    assert _has_word("SAVE $20 on Kindle", ["save $20"])
    assert not _has_word("Save 20 on Kindle", ["save $20"])
    assert not _has_word("Save $200 on Kindle", ["save $20"])


def test_alpha_word_boundaries_unchanged():
    assert not _has_word("Dealers report record sales", ["deal"])
    assert not _has_word("Rediscount window", ["discount"])
    assert _has_word("Big discount on phones", ["discount"])
