import json

import httpx

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
        ("POST", "/rest/v1/editions", {}),
        ("DELETE", "/rest/v1/stories", {"edition_date": "eq.2026-10-18", "position": "gt.2"}),
        ("POST", "/rest/v1/stories", {"on_conflict": "edition_date,position"}),
        ("GET", "/rest/v1/story_companies", {"select": "story_key,company", "edition_date": "eq.2026-10-18", "limit": "1000", "offset": "0"}),
    ]
    stories = json.loads(seen[2].content)
    assert [s["position"] for s in stories] == [1, 2]


def test_save_supabase_saves_whole_feed_with_brief_marked():
    db, seen = fake_db(rest_ok)
    brief = [dict(OUTPUT["stories"][0], brief_position=1, story_key="k1")]
    feed = brief + [dict(OUTPUT["stories"][1], brief_position=None, story_key="k2")]
    save_supabase({**OUTPUT, "stories": brief, "feed": feed}, db)
    rows = json.loads(seen[2].content)
    assert [(r["position"], r["brief_position"], r["story_key"]) for r in rows] == [(1, 1, "k1"), (2, None, "k2")]
    edition = json.loads(seen[0].content)
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
