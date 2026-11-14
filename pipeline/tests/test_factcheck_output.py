import json
from types import SimpleNamespace
from zoneinfo import ZoneInfo

import httpx
import pytest
from test_factcheck import ScriptedLLM, story
from test_store import fake_db

from kernel import run


@pytest.mark.parametrize("ai_enabled", [True, False])
def test_run_persists_each_story_outcome_and_counts(tmp_path, monkeypatch, capsys, ai_enabled):
    ai_story = story()
    feed_story = story(text="", headline="Other publisher title")
    stories = [ai_story, feed_story]
    draft = {"headline": ai_story.headline, "summary": ai_story.summary, "why_it_matters": ai_story.why_it_matters}
    llm = ScriptedLLM(draft, None)
    llm.provider, llm.model = "fake", "fake-model"
    db, requests = fake_db(lambda _: httpx.Response(200, json=[]))
    settings = SimpleNamespace(
        stories_per_brief=1, feed_size=2, sources_file=tmp_path / "sources.yaml",
        max_age_hours=36, embeddings="simple", data_dir=tmp_path, timezone=ZoneInfo("UTC"),
        supabase_url="https://proj.supabase.co", supabase_secret_key="test-key",
    )
    monkeypatch.setattr("sys.argv", ["kernel.run", "--no-images"] + ([] if ai_enabled else ["--no-ai"]))
    monkeypatch.setattr(run, "load_settings", lambda: settings)
    monkeypatch.setattr(run, "make_llm", lambda _: llm)
    monkeypatch.setattr(run, "load_sources", lambda _: ([None], []))
    monkeypatch.setattr(run, "fetch_all", lambda _: ([s.lead for s in stories], {}))
    monkeypatch.setattr(run, "filter_articles", lambda articles, *args: articles)
    monkeypatch.setattr(run, "group_articles", lambda *args: stories)
    monkeypatch.setattr(run, "rank_stories", lambda stories, _: stories)
    monkeypatch.setattr(run, "pick_brief", lambda ranked, _: ranked[:1])
    monkeypatch.setattr(run, "pick_feed", lambda ranked, *args: ranked)
    monkeypatch.setattr(run, "attach_images", lambda *args, **kwargs: 0)
    monkeypatch.setattr(run, "load_recent_stories", lambda *args, **kwargs: [])
    monkeypatch.setattr(run, "collect_discussions", lambda *args: [])
    monkeypatch.setattr(run, "Supabase", lambda *args: db)
    monkeypatch.setattr(run, "record_usage", lambda *args: None)
    run.main()

    output = json.loads((tmp_path / "latest.json").read_text())
    first_state = "fallback" if ai_enabled else "unchecked"
    expected = {run.story_key(ai_story): first_state, run.story_key(feed_story): "unchecked"}
    assert output["stats"]["fact_check_by_story"] == expected
    assert [s["fact_check"] for s in output["feed"]] == [first_state, "unchecked"]
    assert output["stories"][0]["fact_check"] == first_state
    assert output["feed"][0]["summary"] == ai_story.lead.description
    assert output["feed"][0]["why_it_matters"] == ""
    assert output["feed"][1]["summary"] == ""
    assert json.loads((tmp_path / f"brief-{output['date']}.json").read_text()) == output

    edition = next(json.loads(r.content) for r in requests if r.method == "POST" and r.url.path.endswith("/editions"))
    saved = next(json.loads(r.content) for r in requests if r.method == "POST" and r.url.path.endswith("/stories"))
    assert edition["stats"] == output["stats"]
    assert edition["stats"]["fact_check_by_story"] == expected
    assert [s["summary"] for s in saved] == [s["summary"] for s in output["feed"]]
    assert not any(r.method == "POST" and json.loads(r.content)["key"].startswith("check:")
                   for r in requests if r.url.path.endswith("/summary_cache"))
    assert output["stats"]["fact_check"] == {
        "ok": 0, "fixed": 0, "fallback": int(ai_enabled), "unchecked": 1 if ai_enabled else 2,
    }
    assert llm.calls == (2 if ai_enabled else 0)
    assert f"{int(ai_enabled)} replaced by the publisher's words, {1 if ai_enabled else 2} not checked" in capsys.readouterr().out
    db.client.close()
