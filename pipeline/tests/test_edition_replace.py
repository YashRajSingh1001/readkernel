"""Real PostgreSQL/PostgREST tests: put their binaries on PATH and set
READKERNEL_TEST_POSTGREST=1. Each run creates and destroys its own local cluster.
"""
import os
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
import time

import httpx
import pytest

from kernel.store import Supabase, save_supabase

DATE = "2026-11-15"
MIGRATIONS = Path(__file__).resolve().parents[2] / "db" / "migrations"


def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


class Database:
    def __init__(self, uri, url):
        self.uri, self.url = uri, url
        self.db = Supabase(url, "sb_secret_test")
        self.db.base = url

    def sql(self, sql):
        result = subprocess.run(
            ["psql", self.uri, "-XAt", "-v", "ON_ERROR_STOP=1", "-c", sql],
            capture_output=True, text=True, check=True,
        )
        return result.stdout.strip()

    def latest(self):
        response = httpx.get(self.url + "/editions", params={
            "select": "*,stories(*),discussions(*)",
            "stories.order": "position.asc", "discussions.order": "position.asc",
            "order": "date.desc", "limit": "1",
        })
        response.raise_for_status()
        rows = response.json()
        for edition in rows:
            for story in edition["stories"]:
                story.pop("id")
        return rows

    def tags(self):
        return self.db.select("story_companies", {"order": "story_key,company"})


@pytest.fixture(scope="module")
def server():
    if os.environ.get("READKERNEL_TEST_POSTGREST") != "1":
        pytest.skip("set READKERNEL_TEST_POSTGREST=1 to run real PostgreSQL/PostgREST tests")
    for binary in ("initdb", "pg_ctl", "psql", "postgrest"):
        assert shutil.which(binary), f"{binary} must be on PATH"
    with tempfile.TemporaryDirectory(prefix="readkernel-pg-") as root:
        data = Path(root) / "db"
        subprocess.run(["initdb", "-D", str(data), "-A", "trust", "-U", "postgres", "--no-locale", "-E", "UTF8"],
                       capture_output=True, check=True)
        pg_port, rest_port = free_port(), free_port()
        subprocess.run(["pg_ctl", "-D", str(data), "-l", str(Path(root) / "postgres.log"),
                        "-o", f"-h 127.0.0.1 -p {pg_port} -k {root}", "-w", "start"],
                       capture_output=True, check=True)
        rest = None
        database = Database(f"postgresql://postgres@127.0.0.1:{pg_port}/postgres", f"http://127.0.0.1:{rest_port}")
        try:
            database.sql("""
                create role anon; create role authenticated; create role service_role bypassrls;
                create schema auth; create table auth.users (id uuid primary key);
                create function auth.uid() returns uuid language sql as 'select null::uuid';
            """)
            for migration in sorted(MIGRATIONS.glob("*.sql")):
                if not migration.name.startswith("009_"):
                    database.sql(migration.read_text())
            database.sql((MIGRATIONS / "011_atomic_edition_replace.sql").read_text())
            database.sql("""
                grant usage on schema public to service_role;
                grant all on all tables in schema public to service_role;
                grant usage on all sequences in schema public to service_role;
            """)
            config = Path(root) / "postgrest.conf"
            config.write_text(f'''db-uri = "{database.uri}"
db-schemas = "public"
db-anon-role = "service_role"
server-host = "127.0.0.1"
server-port = {rest_port}
''')
            with (Path(root) / "postgrest.log").open("w") as log:
                rest = subprocess.Popen(["postgrest", str(config)], stdout=log, stderr=log)
                for _ in range(100):
                    try:
                        if httpx.get(database.url + "/").is_success:
                            break
                    except httpx.HTTPError:
                        pass
                    assert rest.poll() is None, (Path(root) / "postgrest.log").read_text()
                    time.sleep(0.05)
                else:
                    pytest.fail("PostgREST did not start")
                yield database
        finally:
            database.db.client.close()
            if rest is not None:
                rest.terminate()
                rest.wait(timeout=10)
            subprocess.run(["pg_ctl", "-D", str(data), "-m", "immediate", "-w", "stop"],
                           capture_output=True, check=True)


@pytest.fixture
def database(server):
    server.sql("truncate editions cascade")
    return server


def edition(run, size):
    feed = [{
        "story_key": f"key{n:09d}", "brief_position": 1 if n == size else None,
        "headline": f"{run} story {n}", "summary": "S", "why_it_matters": "", "topic": "ai",
        "score": 10.0 - n, "importance": None, "published": "2026-11-15T01:00:00+00:00",
        "sources": [], "companies": [f"{run} Company {n}"],
    } for n in range(1, size + 1)]
    return {
        "date": DATE, "generated_at": f"2026-11-15T0{1 if run == 'old' else 2}:00:00+00:00",
        "ai": None, "stats": {"feed": size}, "stories": feed[-1:], "feed": feed,
        "discussions": [{"title": f"{run} talk {n}", "url": f"https://example.com/{n}", "source": "hn"}
                        for n in range(1, size + 1)],
    }


@pytest.mark.parametrize("old_size,new_size", [(5, 1), (3, 5), (4, 4), (3, 0)])
def test_rerun_replaces_complete_edition_and_tags(database, old_size, new_size):
    old, new = edition("old", old_size), edition("new", new_size)
    save_supabase(old, database.db)
    new["feed"].reverse()
    save_supabase(new, database.db)
    row, = database.latest()
    assert [s["headline"] for s in row["stories"]] == [s["headline"] for s in new["feed"]]
    assert [s["story_key"] for s in row["stories"]] == [s["story_key"] for s in new["feed"]]
    assert len(row["discussions"]) == new_size
    assert row["story_count"] == len(new["stories"])
    assert row["stats"] == new["stats"]
    assert {r["name"] for r in database.tags()} == {s["companies"][0] for s in new["feed"]}


@pytest.mark.parametrize("table", ["stories", "discussions", "story_companies"])
@pytest.mark.parametrize("first_run", [False, True])
def test_cancelled_transaction_preserves_published_edition(database, table, first_run):
    old = edition("old", 5)
    if first_run:
        old["date"] = "2026-11-14"
    save_supabase(old, database.db)
    before, tags = database.latest(), database.tags()
    database.sql(f"""
        create or replace function pause_replace() returns trigger language plpgsql as $$
        begin perform pg_sleep(15); return new; end; $$;
        create trigger pause_replace before insert on {table}
        for each row execute function pause_replace();
    """)
    try:
        with ThreadPoolExecutor(max_workers=1) as pool:
            pending = pool.submit(save_supabase, edition("new", 1), database.db)
            for _ in range(100):
                if database.sql("select count(*) from pg_stat_activity where wait_event = 'PgSleep'") != "0":
                    break
                time.sleep(0.02)
            else:
                pytest.fail("RPC did not reach the pause after its delete")
            assert database.latest() == before
            assert database.tags() == tags
            database.sql("select pg_cancel_backend(pid) from pg_stat_activity where wait_event = 'PgSleep'")
            with pytest.raises(httpx.HTTPStatusError):
                pending.result(timeout=10)
        assert database.latest() == before
        assert database.tags() == tags
    finally:
        database.sql(f"drop trigger pause_replace on {table}")
    save_supabase(edition("new", 1), database.db)
    assert database.latest()[0]["stories"][0]["headline"] == "new story 1"


def test_response_lost_after_commit_can_be_retried(database):
    save_supabase(edition("old", 3), database.db)
    real = database.db.client

    def lose_response(request):
        real.send(request).raise_for_status()
        raise httpx.ReadError("response lost after commit", request=request)

    database.db.client = httpx.Client(transport=httpx.MockTransport(lose_response))
    try:
        with pytest.raises(httpx.ReadError):
            save_supabase(edition("new", 2), database.db)
    finally:
        database.db.client.close()
        database.db.client = real
    committed = database.latest(), database.tags()
    save_supabase(edition("new", 2), database.db)
    assert (database.latest(), database.tags()) == committed


def test_request_lost_before_dispatch_keeps_old_brief_in_feed_tail(database):
    save_supabase(edition("old", 5), database.db)
    before, tags = database.latest(), database.tags()
    real = database.db.client

    def lose_request(request):
        raise httpx.ConnectError("request not delivered", request=request)

    database.db.client = httpx.Client(transport=httpx.MockTransport(lose_request))
    try:
        with pytest.raises(httpx.ConnectError):
            save_supabase(edition("new", 1), database.db)
    finally:
        database.db.client.close()
        database.db.client = real
    assert database.latest() == before
    assert database.tags() == tags
    assert [s["headline"] for s in before[0]["stories"] if s["brief_position"]] == ["old story 5"]


def test_replacement_clears_optional_columns_and_preserves_omitted_discussions(database):
    old = edition("old", 3)
    for story in old["feed"]:
        story.update(image_url="https://example.com/old.jpg", image_credit="Old", kind="model_release", thread_id="oldthread")
    old["discussions"][0].update(comments_url="https://example.com/comments", points=5, comments=2, summary="Old")
    save_supabase(old, database.db)
    old_discussions = database.latest()[0]["discussions"]
    new = edition("new", 2)
    new.pop("discussions")
    save_supabase(new, database.db)
    row, = database.latest()
    assert row["discussions"] == old_discussions
    for story in row["stories"]:
        assert (story["image_url"], story["image_credit"], story["kind"], story["thread_id"]) == (None, None, "news", None)
    new["discussions"] = edition("new", 1)["discussions"]
    save_supabase(new, database.db)
    discussion, = database.latest()[0]["discussions"]
    assert (discussion["comments_url"], discussion["points"], discussion["comments"], discussion["summary"]) == (None, None, None, "")
    new["discussions"] = []
    save_supabase(new, database.db)
    assert database.latest()[0]["discussions"] == []


def test_concurrent_reruns_do_not_mix_editions(database):
    outputs = [edition("old", 5), edition("new", 2)]
    with ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(lambda output: save_supabase(output, database.db), outputs))
    row, = database.latest()
    run = row["stories"][0]["headline"].split()[0]
    assert all(s["headline"].startswith(run) for s in row["stories"])
    assert all(d["title"].startswith(run) for d in row["discussions"])
    assert all(t["name"].startswith(run) for t in database.tags())
    assert row["stats"]["feed"] == len(row["stories"]) == len(row["discussions"]) == len(database.tags())


def test_rpc_is_only_executable_by_service_role(database):
    signature = "public.replace_edition(jsonb,jsonb,jsonb,jsonb)"
    for role, allowed in [("anon", "f"), ("authenticated", "f"), ("service_role", "t")]:
        assert database.sql(f"select has_function_privilege('{role}', '{signature}', 'execute')") == allowed
