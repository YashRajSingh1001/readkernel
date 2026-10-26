import json

import anyio
import httpx
import pytest
from mcp import Client

from kernel import mcp_server
from kernel.mcp_server import DbReader, FileReader, build_server


def story(key, headline, topic="ai", brief_position=None, thread_id=None, score=1.0, summary="Summary."):
    return {
        "story_key": key,
        "brief_position": brief_position,
        "headline": headline,
        "summary": summary,
        "why_it_matters": "It matters.",
        "topic": topic,
        "kind": "news",
        "score": score,
        "importance": 3,
        "published": "2026-10-26T01:00:00+00:00",
        "image_url": "https://img/x.jpg",
        "thread_id": thread_id or key,
        "sources": [{"name": "Src", "title": headline, "url": f"https://news/{key}", "published": "x"}],
    }


def write_brief(data_dir, date, feed, discussions=()):
    brief = sorted((s for s in feed if s["brief_position"]), key=lambda s: s["brief_position"])
    data = {"date": date, "generated_at": f"{date}T00:30:00+00:00", "ai": None, "stats": {},
            "stories": brief, "feed": feed, "discussions": list(discussions)}
    (data_dir / f"brief-{date}.json").write_text(json.dumps(data), encoding="utf-8")


@pytest.fixture
def data_dir(tmp_path, monkeypatch):
    monkeypatch.delenv("SITE_URL", raising=False)
    write_brief(tmp_path, "2026-10-25", [
        story("chip-ban-aaa", "Chip export rules tighten", "tech", 1, thread_id="chip-thread"),
    ])
    write_brief(tmp_path, "2026-10-26", [
        story("model-launch-bbb", "Lab ships open model", "ai", 1, score=9),
        story("chip-ban-ccc", "Chip export rules take effect", "tech", 2, thread_id="chip-thread", score=7),
        story("db-release-ddd", "Postgres 19 released", "dev", None, score=3),
    ], discussions=[{"title": "Show HN: thing", "url": "https://hn/1", "comments_url": "https://hn/c1",
                     "source": "hn", "points": 300, "comments": 120, "summary": "A thing."}])
    return tmp_path


def call(server, tool, args=None):
    async def go():
        async with Client(server) as client:
            return await client.call_tool(tool, args or {})
    return anyio.run(go)


def test_lists_the_tools_as_read_only(data_dir):
    async def go():
        async with Client(build_server(FileReader(data_dir))) as client:
            return await client.list_tools()
    tools = {t.name: t for t in anyio.run(go).tools}
    assert set(tools) == {"get_brief", "get_feed", "search_stories", "get_story_thread",
                          "list_editions", "get_top_discussions", "list_sources"}
    assert all(t.annotations.read_only_hint for t in tools.values())


def test_brief_defaults_to_the_latest_edition(data_dir):
    result = call(build_server(FileReader(data_dir)), "get_brief")
    brief = result.structured_content
    assert brief["date"] == "2026-10-26"
    assert [s["headline"] for s in brief["stories"]] == ["Lab ships open model", "Chip export rules take effect"]
    assert brief["stories"][0]["sources"] == [
        {"name": "Src", "title": "Lab ships open model", "url": "https://news/model-launch-bbb"}]
    assert "image_url" not in brief["stories"][0]  # layout fields are dropped


def test_feed_filters_by_topic_and_limit(data_dir):
    feed = call(build_server(FileReader(data_dir)), "get_feed", {"topic": "dev"}).structured_content
    assert feed["total"] == 1 and feed["stories"][0]["headline"] == "Postgres 19 released"
    feed = call(build_server(FileReader(data_dir)), "get_feed", {"limit": 2}).structured_content
    assert len(feed["stories"]) == 2


def test_search_and_thread_span_days(data_dir):
    server = build_server(FileReader(data_dir))
    found = call(server, "search_stories", {"query": "chip export"}).structured_content["stories"]
    assert [s["date"] for s in found] == ["2026-10-26", "2026-10-25"]
    thread = call(server, "get_story_thread", {"key": "chip-thread"}).structured_content
    assert thread["days"] == 2 and thread["stories"][0]["headline"] == "Chip export rules take effect"


def test_discussions_and_editions(data_dir):
    server = build_server(FileReader(data_dir))
    disc = call(server, "get_top_discussions", {"date": "2026-10-26"}).structured_content
    assert disc["discussions"][0]["points"] == 300
    eds = call(server, "list_editions").structured_content["editions"]
    assert [e["date"] for e in eds] == ["2026-10-26", "2026-10-25"]
    assert eds[0]["lead"] == "Lab ships open model"


def test_bad_input_comes_back_as_a_tool_error(data_dir):
    server = build_server(FileReader(data_dir))
    for tool, args in [("get_brief", {"date": "2026-13-40"}), ("get_brief", {"date": "2026-01-01"}),
                       ("get_story_thread", {"key": "x),story_key.neq.("}), ("get_feed", {"topic": "sports"}),
                       ("search_stories", {"query": " "})]:
        result = call(server, tool, args)
        assert result.is_error, (tool, args)


def test_latest_brief_resource(data_dir):
    async def go():
        async with Client(build_server(FileReader(data_dir))) as client:
            return await client.read_resource("readkernel://brief/latest")
    contents = anyio.run(go).contents
    assert json.loads(contents[0].text)["date"] == "2026-10-26"


def test_site_links_when_site_url_is_set(data_dir, monkeypatch):
    monkeypatch.setenv("SITE_URL", "https://readkernel.in/")
    brief = call(build_server(FileReader(data_dir)), "get_brief").structured_content
    assert brief["stories"][0]["link"] == "https://readkernel.in/story/model-launch-bbb"


def test_database_reader_sends_read_only_queries():
    seen: list[httpx.Request] = []

    def handler(request):
        seen.append(request)
        return httpx.Response(200, json=[])

    reader = DbReader("https://proj.supabase.co", "sb_publishable_test")
    reader.db.client = httpx.Client(transport=httpx.MockTransport(handler), headers=reader.db.client.headers)
    reader.edition(None)
    reader.search('open "model" -rumour', 5)
    reader.thread("chip-thread")
    assert all(r.method == "GET" for r in seen)
    assert all(r.headers["apikey"] == "sb_publishable_test" for r in seen)
    latest = seen[0].url.params
    assert latest["order"] == "date.desc" and latest["limit"] == "1"
    assert seen[1].url.params["search"] == 'wfts(english).open "model" -rumour'
    assert seen[2].url.params["or"] == "(thread_id.eq.chip-thread,story_key.eq.chip-thread)"


def test_never_uses_the_secret_key(monkeypatch, tmp_path, capsys):
    monkeypatch.setenv("SUPABASE_URL", "https://proj.supabase.co")
    monkeypatch.setenv("SUPABASE_SECRET_KEY", "sb_secret_test")
    monkeypatch.delenv("SUPABASE_PUBLISHABLE_KEY", raising=False)
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    assert isinstance(mcp_server.make_reader(), FileReader)
    assert "secret key is never used" in capsys.readouterr().err
    monkeypatch.setenv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test")
    reader = mcp_server.make_reader()
    assert isinstance(reader, DbReader) and reader.db.client.headers["apikey"] == "sb_publishable_test"


def test_error_messages_reach_the_assistant(tmp_path):
    result = call(build_server(FileReader(tmp_path)), "get_brief", {"date": "26-10-2026"})
    assert result.is_error and "YYYY-MM-DD" in result.content[0].text
    result = call(build_server(FileReader(tmp_path)), "get_brief")
    assert result.is_error and "no briefs yet" in result.content[0].text
