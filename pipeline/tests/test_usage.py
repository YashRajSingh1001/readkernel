from kernel.llm import LLM
from kernel.usage import record_usage


def test_groq_usage_adds_up_over_calls():
    llm = LLM("groq", "key", "openai/gpt-oss-120b")
    reply = {
        "prompt_tokens": 77,
        "completion_tokens": 23,
        "completion_tokens_details": {"reasoning_tokens": 11},
    }
    llm._add_usage(reply)
    llm._add_usage({**reply, "prompt_tokens_details": {"cached_tokens": 50}})
    llm._add_usage(None)
    assert llm.usage == {
        "calls": 3, "calls_without_usage": 1, "input": 154, "cached_input": 50,
        "cache_write": 0, "output": 46, "reasoning": 22,
    }


def test_claude_cache_tokens_count_as_input():
    llm = LLM("claude", "key", "claude-haiku-5-5")
    llm._add_usage({
        "input_tokens": 10, "cache_read_input_tokens": 100,
        "cache_creation_input_tokens": 5, "output_tokens": 40,
    })
    u = llm.usage
    assert (u["input"], u["cached_input"], u["cache_write"], u["output"]) == (115, 100, 5, 40)


class FailingDB:
    def __init__(self):
        self.tried = []

    def insert(self, table, rows):
        self.tried.append((table, rows))
        raise RuntimeError("relation ai_usage does not exist")


def test_saving_never_stops_the_job(monkeypatch, capsys):
    monkeypatch.setenv("GITHUB_ACTIONS", "true")
    llm = LLM("groq", "key", "openai/gpt-oss-120b")
    llm._add_usage({"prompt_tokens": 5, "completion_tokens": 2})
    db = FailingDB()
    record_usage(db, llm, "run")
    (table, [row]), = db.tried
    assert table == "ai_usage"
    assert row["source"] == "pipeline:run" and row["env"] == "production" and row["input_tokens"] == 5
    assert "not saved" in capsys.readouterr().out


def test_nothing_recorded_without_ai_calls():
    db = FailingDB()
    record_usage(db, None, "run")
    record_usage(db, LLM("groq", "key", "m"), "run")
    assert db.tried == []
