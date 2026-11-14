"""What a pipeline job's AI calls cost: one ai_usage row per run (db/migrations/008).

Tokens only; the cost is worked out from ai_prices when it's read (views
ai_usage_costed and ai_cost_daily). Never stops a job: without the migration,
or without a database, it just prints the totals.
"""

from __future__ import annotations

import os

from .llm import LLM
from .store import Supabase


def record_usage(db: Supabase | None, llm: LLM | None, job: str) -> None:
    """Prints and saves the AI usage of one job run (job: run, company_blogs, watches)."""
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
        # The daily runs are on GitHub Actions; anything else is someone trying it locally.
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
    except Exception as exc:  # a missing table must never fail the daily brief
        print(f"[usage] not saved (run db/migrations/008?): {str(exc)[:160]}")
