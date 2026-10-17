"""Core data shapes passed between pipeline steps."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime


@dataclass(frozen=True)
class Source:
    name: str
    url: str
    topic: str
    weight: float = 1.0
    exclude: tuple[str, ...] = ()


@dataclass
class Article:
    url: str
    title: str
    description: str
    source: str
    topic: str
    weight: float
    published: datetime


@dataclass
class Story:
    """One real-world event, covered by one or more articles."""

    articles: list[Article]
    score: float = 0.0
    importance: int | None = None  # 1-5 from the AI editor, if it ran
    headline: str = ""
    summary: str = ""
    why_it_matters: str = ""
    extra: dict = field(default_factory=dict)

    @property
    def lead(self) -> Article:
        return self.articles[0]

    @property
    def sources(self) -> list[str]:
        seen: list[str] = []
        for a in self.articles:
            if a.source not in seen:
                seen.append(a.source)
        return seen

    @property
    def topic(self) -> str:
        counts: dict[str, float] = {}
        for a in self.articles:
            counts[a.topic] = counts.get(a.topic, 0.0) + a.weight
        return max(counts, key=counts.get)

    @property
    def newest(self) -> datetime:
        return max(a.published for a in self.articles)
