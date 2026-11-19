import json

import httpx
import pytest

from kernel.store import Supabase, SupabaseCache, save_files, save_supabase

OUTPUT = {
    "date": "2026-10-18",
    "generated_at": "2026-10-18T03:00:00+00:00",
    "ai": None,
    "stats": {"stories": 2},
    "stories": [
        {
            "headline": "First", "summary": "S", "why_it_matters": "", "topic": "ai",
            "score": 5.0, "importance": None, "published": "2026-10-18T01:00:00+00:00",
            "sources": [{"name": "A", "title": "First", "url": "https://a", "published": "x"}],
        },
        {
            "headline": "Second", "summary": "S", "why_it_matters": "", "topic": "dev",
            "score": 4.0, "importance": 3, "published": "2026-10-18T00:00:00+00:00", "sources": [],
        },
    ],
}


def fake_db(handler) -> tuple[Supabase, list[httpx.Request]]:
    seen: list[httpx.Request] = []

    def record(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return handler(request)

    db = Supabase("https://proj.supabase.co", "sb_secret_test")
    db.client = httpx.Client(transport=httpx.MockTransport(record), headers=db.client.headers)
    return db, seen


def rest_ok(request: httpx.Request) -> httpx.Response:
    return httpx.Response(200, json=[]) if request.method == "GET" else httpx.Response(201)


def test_save_supabase_replaces_the_days_stories():
    db, seen = fake_db(rest_ok)
    save_supabase(OUTPUT, db)
    calls = [(r.method, r.url.path, dict(r.url.params)) for r in seen]
    assert calls == [
        ("POST", "/rest/v1/rpc/replace_edition", {}),
    ]
    stories = json.loads(seen[0].content)["p_stories"]
    assert [s["position"] for s in stories] == [1, 2]
    assert seen[0].headers["prefer"] == "return=minimal"
    assert json.loads(seen[0].content)["p_discussions"] is None
    assert json.loads(seen[0].content)["p_companies"] == []


def test_save_supabase_saves_whole_feed_with_brief_marked():
    db, seen = fake_db(rest_ok)
    brief = [dict(OUTPUT["stories"][0], brief_position=1, story_key="k1")]
    feed = brief + [dict(OUTPUT["stories"][1], brief_position=None, story_key="k2")]
    save_supabase({**OUTPUT, "stories": brief, "feed": feed}, db)
    rows = json.loads(seen[0].content)["p_stories"]
    assert [(r["position"], r["brief_position"], r["story_key"]) for r in rows] == [(1, 1, "k1"), (2, None, "k2")]
    edition = json.loads(seen[0].content)["p_edition"]
    assert edition["story_count"] == 1
    assert seen[0].headers["apikey"] == "sb_secret_test"
    assert "authorization" not in seen[0].headers


def test_supabase_cache_round_trip_and_tolerates_errors():
    db, _ = fake_db(lambda r: httpx.Response(200, json=[{"body": {"headline": "H"}}]))
    assert SupabaseCache(db).get("k") == {"headline": "H"}

    broken, _ = fake_db(lambda r: httpx.Response(500))
    assert SupabaseCache(broken).get("k") is None
    SupabaseCache(broken).put("k", {})


def test_save_files_writes_dated_and_latest(tmp_path):
    latest = save_files(OUTPUT, tmp_path)
    assert latest.name == "latest.json"
    assert (tmp_path / "brief-2026-10-18.json").exists()


def test_missing_rpc_fails_without_falling_back_to_destructive_requests():
    db, seen = fake_db(lambda r: httpx.Response(404, json={"code": "PGRST202"}))
    with pytest.raises(httpx.HTTPStatusError):
        save_supabase(OUTPUT, db)
    assert len(seen) == 1
    assert seen[0].url.path == "/rest/v1/rpc/replace_edition"


def test_upsert_uses_primary_key_and_postgrest_merge_headers():
    db, seen = fake_db(rest_ok)
    SupabaseCache(db).put("key", {"headline": "H"})
    assert seen[0].url.path == "/rest/v1/summary_cache"
    assert not seen[0].url.params
    assert seen[0].headers["prefer"] == "resolution=merge-duplicates,return=minimal"
