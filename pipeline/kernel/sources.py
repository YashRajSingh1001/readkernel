from __future__ import annotations

from pathlib import Path

import yaml

from .models import Source

TOPICS = {"ai", "tech", "dev", "startups", "security", "markets", "design"}


def load_sources(path: Path) -> tuple[list[Source], list[str]]:
    raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    sources: list[Source] = []
    seen_urls: set[str] = set()
    for i, entry in enumerate(raw.get("sources") or []):
        for key in ("name", "url", "topic"):
            if not entry.get(key):
                raise ValueError(f"source #{i + 1} is missing '{key}'")
        if entry["topic"] not in TOPICS:
            raise ValueError(f"{entry['name']}: unknown topic '{entry['topic']}'")
        if entry["url"] in seen_urls:
            raise ValueError(f"{entry['name']}: duplicate url {entry['url']}")
        seen_urls.add(entry["url"])
        sources.append(
            Source(
                name=entry["name"],
                url=entry["url"],
                topic=entry["topic"],
                weight=float(entry.get("weight", 1.0)),
                exclude=tuple(w.lower() for w in entry.get("exclude") or ()),
            )
        )
    global_exclude = [w.lower() for w in raw.get("global_exclude") or []]
    return sources, global_exclude


def export_for_web(sources: list[Source], path: Path) -> None:
    import json
    from urllib.parse import urlsplit

    rows = []
    for s in sources:
        host = urlsplit(s.url).netloc
        for prefix in ("feeds.", "feed.", "rss."):
            host = host.removeprefix(prefix)
        rows.append({"name": s.name, "topic": s.topic, "site": f"https://{host}"})
    path.write_text(json.dumps(rows, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    from .config import PIPELINE_DIR, load_settings

    found, _ = load_sources(load_settings().sources_file)
    target = PIPELINE_DIR.parent / "web" / "lib" / "sources.json"
    export_for_web(found, target)
    print(f"wrote {len(found)} sources to {target}")
