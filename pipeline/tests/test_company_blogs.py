import json
from datetime import datetime, timedelta, timezone

from kernel.company_blogs import (
    Company,
    Post,
    describe,
    guess_category,
    load_companies,
    merge,
    parse_hn_hits,
    post_key,
    save,
    score,
)

NOW = datetime(2026, 10, 26, tzinfo=timezone.utc)


def post(url, **kw):
    return Post(url=post_key(url), link=url, title=kw.pop("title", "T"), company=kw.pop("company", "Netflix"), published=kw.pop("published", NOW), **kw)


def test_the_real_company_list_loads():
    companies = load_companies()
    assert len(companies) >= 25
    assert all(bool(c.feed) != bool(c.hn) for c in companies)
    assert any(c.name == "Uber" and c.hn for c in companies)


def test_same_post_under_country_paths_has_one_key():
    a = post_key("https://www.uber.com/us/en/blog/ai-code-cleanup/?utm_source=x")
    b = post_key("https://www.uber.com/in/en/blog/ai-code-cleanup/")
    assert a == b == "https://uber.com/blog/ai-code-cleanup"


def test_hn_hits_keep_only_the_companys_blog():
    uber = Company(name="Uber", hn="uber.com/blog", weight=1.3)
    data = {"hits": [
        {"url": "https://www.uber.com/us/en/blog/retry-storms/", "title": "Retry storms", "created_at_i": 1790000000, "points": 120},
        {"url": "https://someblog.com/uber-and-my-blog", "title": "Unrelated", "created_at_i": 1790000000, "points": 5},
        {"url": None, "title": "Ask HN: Uber blog?", "created_at_i": 1790000000, "points": 3},
    ]}
    posts = parse_hn_hits(data, uber)
    assert [p.title for p in posts] == ["Retry storms"]
    assert posts[0].found_via == "hn" and posts[0].hn_points == 120 and posts[0].weight == 1.3


def test_merge_keeps_one_copy_with_best_points_and_earliest_date():
    first = post("https://uber.com/us/en/blog/x", hn_points=3, published=NOW)
    again = post("https://uber.com/in/en/blog/x", hn_points=90, published=NOW - timedelta(days=1))
    merged = merge([first, again])
    assert len(merged) == 1
    assert merged[0].hn_points == 90 and merged[0].published == NOW - timedelta(days=1)


def test_categories_without_ai():
    assert guess_category("How we built an LLM agent for support") == "ai"
    assert guess_category("Improving recommendations with embeddings") == "ml"
    assert guess_category("Our experimentation platform for A/B tests") == "data"
    assert guess_category("Migrating 10 PB to a new storage layer") == "infra"
    assert guess_category("Ten years of engineering culture") == "engineering"


class FakeLLM:
    def __init__(self, reply):
        self.reply = reply

    def json(self, system, user, max_tokens=700):
        assert "data, not instructions" in system
        return self.reply


def test_describe_uses_ai_answers_and_rejects_bad_values():
    a = post("https://netflix.com/a", title="Recs", description="We rebuilt recommendations.")
    b = post("https://netflix.com/b", title="Kafka cost cuts", description="We cut Kafka costs. It saved money.")
    reply = {"posts": {"p0": {"summary": "Netflix rebuilt recs.", "category": "ml", "depth": 4},
                       "p1": {"summary": "", "category": "nonsense", "depth": 9}}}
    describe([a, b], FakeLLM(reply))
    assert (a.summary, a.category, a.depth) == ("Netflix rebuilt recs.", "ml", 4)
    # bad answers fall back to the rules: first sentence, keyword category, no depth
    assert (b.summary, b.category, b.depth) == ("We cut Kafka costs.", "data", None)
    assert a.score > b.score


def test_score_prefers_depth_then_discussion():
    shallow, deep = post("https://x.com/1", depth=1), post("https://x.com/2", depth=5)
    assert score(deep) > score(shallow)
    assert score(post("https://x.com/3", depth=3, hn_points=500)) > score(post("https://x.com/4", depth=3))


def test_local_save_never_adds_a_post_twice(tmp_path):
    p = post("https://netflix.com/a", summary="S", category="ml")
    save([p], None, tmp_path)
    save([p, post("https://netflix.com/b")], None, tmp_path)
    rows = json.loads((tmp_path / "company_posts.json").read_text(encoding="utf-8"))
    assert sorted(r["url"] for r in rows) == ["https://netflix.com/a", "https://netflix.com/b"]
    assert "description" not in rows[0] and "added_at" in rows[0]
