from __future__ import annotations

import os

from .llm import LLM
from .store import Supabase


def record_usage(db: Supabase | None, llm: LLM | None, job: str) -> None:
    u = getattr(llm, "usage", None)
    if not u or not u["calls"]:
        return
    print(
        f"[usage] {job}: {u['calls']} AI call(s) on {llm.provider}:{llm.model}, "
        f"{u['input']} in ({u['cached_input']} cached), {u['output']} out ({u['reasoning']} reasoning)"
    )
    if db is None or os.environ.get("AI_USAGE_LOG") == "off":
        return
    row = {
        "source": f"pipeline:{job}",
        "env": "production" if os.environ.get("GITHUB_ACTIONS") == "true" else "local",
        "provider": llm.provider,
        "model": llm.model,
        "calls": u["calls"],
        "calls_without_usage": u["calls_without_usage"],
        "input_tokens": u["input"],
        "cached_input_tokens": u["cached_input"],
        "cache_write_tokens": u["cache_write"],
        "output_tokens": u["output"],
        "reasoning_tokens": u["reasoning"],
    }
    try:
        db.insert("ai_usage", [row])
    except Exception as exc:
        print(f"[usage] not saved (run db/migrations/008?): {str(exc)[:160]}")
