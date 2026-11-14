import copy
import json
from pathlib import Path

import httpx
import pytest

from kernel.store import Supabase, save_files, save_supabase

DATE = "2026-11-15"

UNIQUE = {
    "editions": [("date",)],
    "stories": [("id",), ("edition_date", "position")],
    "discussions": [("edition_date", "position")],
    "story_companies": [("edition_date", "story_key", "company")],
}
DEFAULTS = {"stories": {"image_url": None, "image_credit": None, "kind": "news", "thread_id": None}}


class Interrupted(httpx.ConnectError):
    pass


class FakePostgrest:
    def __init__(self):
        self.tables = {name: [] for name in UNIQUE}
        self.next_id = 1
        self.fail_at = None
        self.requests = 0
        self.after_each = None

    def handle(self, request: httpx.Request) -> httpx.Response:
        self.requests += 1
        if self.requests == self.fail_at:
            raise Interrupted("connection lost", request=request)
        table = request.url.path.rsplit("/", 1)[-1]
        params = dict(request.url.params)
        if request.method == "GET":
            response = self.get(table, params)
        elif request.method == "DELETE":
            self.tables[table] = [r for r in self.tables[table] if not matches(r, params)]
            response = httpx.Response(204)
        else:
            response = self.post(table, request, params)
        if self.after_each and response.status_code < 300:
            self.after_each(self)
        return response

    def get(self, table, params):
        offset, limit = int(params.pop("offset", 0)), int(params.pop("limit", 1000))
        cols = params.pop("select", "*").split(",")
        rows = [r for r in self.tables[table] if matches(r, params)][offset:offset + limit]
        return httpx.Response(200, json=[r if cols == ["*"] else {c: r.get(c) for c in cols} for r in rows])

    def post(self, table, request, params):
        body = json.loads(request.content)
        rows = body if isinstance(body, list) else [body]
        if len({tuple(sorted(r)) for r in rows}) > 1:
            return httpx.Response(400, json={"code": "PGRST102", "message": "All object keys must match"})
        prefer = request.headers.get("prefer", "")
        merge = "merge-duplicates" in prefer
        conflict = tuple(params["on_conflict"].split(",")) if "on_conflict" in params else UNIQUE[table][-1]
        staged = copy.deepcopy(self.tables[table])
        for row in rows:
            found = next((r for r in staged if all(r.get(c) == row.get(c) for c in conflict)), None)
            if found and merge:
                found.update(row)
                continue
            new = {**DEFAULTS.get(table, {}), **row}
            if table == "stories":
                new["id"] = self.next_id
                self.next_id += 1
            for key in UNIQUE[table]:
                if any(all(r.get(c) == new.get(c) for c in key) for r in staged):
                    return httpx.Response(409, json={"code": "23505"})
            staged.append(new)
        self.tables[table] = staged
        return httpx.Response(201)

    def rows(self, table):
        return sorted((r for r in self.tables[table] if r["edition_date"] == DATE), key=lambda r: r.get("position") or 0)


def matches(row, params):
    for col, expr in params.items():
        op, value = expr.split(".", 1)
        current = row.get(col)
        if op == "eq" and str(current) != value:
            return False
        if op == "gt" and not (current is not None and current > int(value)):
            return False
        if op == "lt" and not (current is not None and str(current) < value):
            return False
    return True


def story(n, run, **extra):
    return {
        "story_key": f"{run}-key-{n}", "brief_position": n if n <= 2 else None, "headline": f"{run} story {n}",
        "summary": "S", "why_it_matters": "", "topic": "ai", "score": 1.0, "importance": None,
        "published": "2026-11-15T01:00:00+00:00", "sources": [], "thread_id": f"{run}-thread-{n}",
        "companies": [f"{run}co{n}"], **extra,
    }


def edition(run, size, extra=None):
    feed = [story(n, run, **(extra or {}).get(n, {})) for n in range(1, size + 1)]
    discussions = [{"title": f"{run} talk {n}", "url": f"https://{run}/{n}", "source": "hn"} for n in range(1, size + 1)]
    return {"date": DATE, "generated_at": f"{run}-time", "ai": None, "stats": {}, "stories": feed[:2], "feed": feed,
            "discussions": discussions}


def connect(fake) -> Supabase:
    db = Supabase("https://proj.supabase.co", "sb_secret_test")
    db.client = httpx.Client(transport=httpx.MockTransport(fake.handle), headers=db.client.headers)
    return db


def snapshot(fake):
    return {t: [{k: v for k, v in r.items() if k != "id"} for r in fake.rows(t)] for t in ("stories", "discussions", "story_companies")}


def check_edition(fake, old, new):
    stories = [{k: v for k, v in r.items() if k != "id"} for r in fake.rows("stories")]
    assert stories, "edition has no stories"
    assert fake.rows("discussions"), "edition has no discussions"
    briefs = [r["brief_position"] for r in stories if r["brief_position"] is not None]
    assert len(briefs) == len(set(briefs)), f"duplicate brief positions {briefs}"
    keys = [r["story_key"] for r in stories]
    assert len(keys) == len(set(keys)), f"duplicate story keys {keys}"
    by_old = {r["position"]: r for r in old["stories"]}
    by_new = {r["position"]: r for r in new["stories"]}
    all_old = all(by_old.get(r["position"]) == r for r in stories)
    all_new = all(by_new.get(r["position"]) == r for r in stories)
    assert all_old or all_new, f"stories mix two runs or leak old columns: {stories}"


SHAPES = [(5, 3), (3, 5), (4, 4)]
OLD_EXTRA = {n: {"image_url": f"https://img/{n}", "image_credit": "Old", "kind": "model_release"} for n in range(1, 6)}


def expected(run, size, extra=None):
    fake = FakePostgrest()
    save_supabase(edition(run, size, extra), connect(fake))
    return snapshot(fake), fake.requests


@pytest.mark.parametrize("old_size,new_size", SHAPES)
def test_rerun_never_leaves_the_edition_empty_or_mixed(old_size, new_size):
    old, _ = expected("old", old_size, OLD_EXTRA)
    new, steps = expected("new", new_size)
    for fail_at in range(1, steps + 1):
        fake = FakePostgrest()
        db = connect(fake)
        save_supabase(edition("old", old_size, OLD_EXTRA), db)
        fake.requests, fake.fail_at = 0, fail_at
        fake.after_each = lambda f: check_edition(f, old, new)
        try:
            save_supabase(edition("new", new_size), db)
        except httpx.HTTPError:
            pass
        check_edition(fake, old, new)

        fake.fail_at = None
        save_supabase(edition("new", new_size), db)
        assert snapshot(fake) == new, f"rerun after failing at request {fail_at} did not converge"


def test_rerun_clears_columns_the_new_story_does_not_have():
    fake = FakePostgrest()
    db = connect(fake)
    save_supabase(edition("old", 3, OLD_EXTRA), db)
    save_supabase(edition("new", 3), db)
    for row in fake.rows("stories"):
        assert (row["image_url"], row["image_credit"], row["kind"]) == (None, None, "news")


def test_rerun_replaces_company_tags_and_keeps_them_during_the_swap():
    fake = FakePostgrest()
    db = connect(fake)
    save_supabase(edition("old", 3), db)
    fake.after_each = lambda f: f.rows("story_companies") or pytest.fail("company tags went empty")
    save_supabase(edition("new", 2), db)
    tags = {(r["story_key"], r["company"]) for r in fake.rows("story_companies")}
    assert tags == {("new-key-1", "newco1"), ("new-key-2", "newco2")}


def test_shorter_rerun_keeps_the_old_brief_until_the_new_rows_land():
    fake = FakePostgrest()
    db = connect(fake)
    save_supabase(edition("old", 5), db)
    fake.requests, fake.fail_at = 0, 3
    with pytest.raises(httpx.HTTPError):
        save_supabase(edition("new", 3), db)
    rows = fake.rows("stories")
    assert [r["headline"] for r in rows] == ["old story 1", "old story 2", "old story 3"]
    assert [r["brief_position"] for r in rows if r["brief_position"]] == [1, 2]


def test_interrupted_file_write_keeps_the_previous_latest(tmp_path, monkeypatch):
    save_files({"date": "2026-11-14", "stories": ["old"]}, tmp_path)

    def broken(self, target):
        raise OSError("disk full")

    monkeypatch.setattr(Path, "replace", broken)
    with pytest.raises(OSError):
        save_files({"date": DATE, "stories": ["new"]}, tmp_path)
    assert json.loads((tmp_path / "latest.json").read_text())["stories"] == ["old"]
    assert not (tmp_path / f"brief-{DATE}.json").exists()
