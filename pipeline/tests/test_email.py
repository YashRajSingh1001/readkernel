from email import message_from_bytes

from kernel.mailer import PreviewMailer
from kernel.newsletter import render
from kernel.send import message_for

EDITION = {
    "date": "2026-10-18",
    "stories": [
        {
            "headline": "Chipmaker <b>buys</b> rival & co",
            "summary": "It paid $5 billion.",
            "why_it_matters": "Fewer suppliers.",
            "topic": "tech",
            "sources": [
                {"name": "A", "url": "https://a.example/1?x=1&y=2"},
                {"name": "B", "url": "https://b.example/2"},
            ],
        },
        {"headline": "Second story", "summary": "", "why_it_matters": "", "topic": "ai", "sources": []},
    ],
}


def test_render_escapes_html_and_links_unsubscribe():
    subject, html, text = render(EDITION, "https://readkernel.example", token="tok123")
    assert subject.startswith("Chipmaker <b>buys</b> rival & co")
    assert "&lt;b&gt;buys&lt;/b&gt; rival &amp; co" in html
    assert "<b>buys</b>" not in html
    assert "https://readkernel.example/unsubscribe?token=tok123" in html
    assert "https://readkernel.example/unsubscribe?token=tok123" in text
    assert "Sunday 18 October" in html
    assert "2 sources" in html


def test_message_has_one_click_unsubscribe_headers():
    msg = message_for(EDITION, "a@b.co", "tok123", "https://readkernel.example")
    assert msg.headers["List-Unsubscribe"] == "<https://readkernel.example/api/unsubscribe?token=tok123>"
    assert msg.headers["List-Unsubscribe-Post"] == "List-Unsubscribe=One-Click"
    test_msg = message_for(EDITION, "a@b.co", None, "https://readkernel.example")
    assert "List-Unsubscribe" not in test_msg.headers


def test_preview_mailer_writes_a_valid_email(tmp_path):
    mailer = PreviewMailer("ReadKernel <news@readkernel.example>", tmp_path)
    mailer.send(message_for(EDITION, "Reader@Example.com", "tok", "https://r.example"))
    files = list(tmp_path.glob("*.eml"))
    assert len(files) == 1
    parsed = message_from_bytes(files[0].read_bytes())
    assert parsed["To"] == "Reader@Example.com"
    assert parsed["List-Unsubscribe-Post"] == "List-Unsubscribe=One-Click"
    assert {p.get_content_type() for p in parsed.walk()} >= {"text/plain", "text/html"}


def test_formats_change_what_the_email_contains():
    story = dict(EDITION["stories"][0], image_url="https://img.example/a.jpg", image_credit="A")
    edition = {**EDITION, "stories": [story]}
    _, headlines_html, headlines_text = render(edition, "https://r.example", "t", fmt="headlines")
    assert "It paid $5 billion." not in headlines_html and "It paid" not in headlines_text
    _, images_html, _ = render(edition, "https://r.example", "t", fmt="images")
    assert "https://img.example/a.jpg" in images_html and "Image: A" in images_html
    _, plain_html, _ = render(edition, "https://r.example", "t")
    assert "img.example" not in plain_html
    assert "https://r.example/preferences?token=t" in plain_html


def test_weekly_subject_and_label():
    subject, html, _ = render({**EDITION, "weekly": True}, "https://r.example", "t")
    assert subject.startswith("The week in tech:")
    assert "This week" in html


def test_rating_links_sit_above_the_footer():
    _, html, text = render(EDITION, "https://r.example", "tok123")
    for r, label in (("good", "Nailed it"), ("ok", "Average"), ("bad", "Missed the mark")):
        url = f"https://r.example/feedback?d=2026-10-18&r={r}&t=tok123"
        assert f"{label}: {url}" in text
        assert url.replace("&", "&amp;") in html and label in html
    assert "How was today&#x27;s brief?" in html and "How was today's brief?" in text
    assert "Reply to this email with a story we missed." in html
    assert text.index("Reply to this email with a story we missed.") < text.index("Read on the web:")
    assert html.index("Missed the mark") < html.index("Read this brief on the web")


def test_rating_links_without_token_and_for_weekly():
    _, html, text = render({**EDITION, "weekly": True}, "https://r.example")
    assert "Nailed it: https://r.example/feedback?d=2026-10-18&r=good\n" in text
    assert "&t=" not in text
    assert "How was this week's brief?" in text and "How was this week&#x27;s brief?" in html


def test_reply_to_header_when_set(tmp_path):
    mailer = PreviewMailer("ReadKernel <brief@r.example>", tmp_path, reply_to="hello@r.example")
    mailer.send(message_for(EDITION, "a@example.com", "tok", "https://r.example"))
    parsed = message_from_bytes(next(tmp_path.glob("*.eml")).read_bytes())
    assert parsed["Reply-To"] == "hello@r.example"


READ = {"company": "Uber", "title": "Retry storms", "summary": "Uber stopped retry storms.", "link": "https://uber.com/blog/x",
        "category": "infra", "depth": 4, "score": 5.2, "url": "https://uber.com/blog/x"}


def test_company_read_appears_unless_turned_off():
    from kernel.send import personal_edition

    edition = {**EDITION, "feed": EDITION["stories"]}
    mine = personal_edition(edition, [], {}, False, [READ])
    _, html, text = render(mine, "https://r.example", "t")
    assert "From company blogs" in html and "Retry storms" in html and "https://r.example/companies" in html
    assert "FROM COMPANY BLOGS" in text and "https://uber.com/blog/x" in text
    off = personal_edition(edition, [], {"company_read": False}, False, [READ])
    assert "From company blogs" not in render(off, "https://r.example", "t")[1]


def test_company_reads_pick_best_new_post_per_company(tmp_path):
    import json
    from datetime import datetime, timedelta, timezone

    from kernel.send import load_company_reads

    now = datetime.now(timezone.utc)
    rows = [
        {**READ, "url": "a", "title": "Old", "added_at": (now - timedelta(days=3)).isoformat(), "score": 9},
        {**READ, "url": "b", "title": "Shallow", "company": "Meta", "depth": 1, "added_at": now.isoformat(), "score": 8},
        {**READ, "url": "c", "title": "Best", "added_at": now.isoformat(), "score": 6},
        {**READ, "url": "d", "title": "Second Uber", "added_at": now.isoformat(), "score": 5},
        {**READ, "url": "e", "title": "Netflix", "company": "Netflix", "added_at": now.isoformat(), "score": 4},
    ]
    (tmp_path / "company_posts.json").write_text(json.dumps(rows), encoding="utf-8")
    assert [r["title"] for r in load_company_reads(None, tmp_path, weekly=False)] == ["Best"]
    assert [r["title"] for r in load_company_reads(None, tmp_path, weekly=True)] == ["Old", "Netflix"]


EXPLAINED = {"slug": "how-sol-works", "title": "How Sol <works>", "what_it_is": "Sol is OpenAI's everyday model."}


def test_explained_block_sits_between_stories_and_company_blogs():
    from kernel.send import personal_edition

    edition = {**EDITION, "feed": EDITION["stories"], "explained": EXPLAINED}
    weekly = personal_edition(edition, EDITION["stories"], {}, True, [READ])
    assert ">Explained<" in render(weekly, "https://r.example", "t")[1]
    daily = personal_edition(edition, [], {}, False, [READ])
    _, html, text = render(daily, "https://r.example", "t", fmt="headlines")
    assert "How Sol &lt;works&gt;" in html and "Sol is OpenAI&#x27;s everyday model." in html
    assert "https://r.example/explained/how-sol-works" in html
    assert html.index("Second story") < html.index(">Explained<") < html.index("From company blogs")
    assert "EXPLAINED\n- How Sol <works>\n  Sol is OpenAI's everyday model.\n  https://r.example/explained/how-sol-works" in text
    assert text.index("Second story") < text.index("EXPLAINED") < text.index("FROM COMPANY BLOGS")
    _, plain_html, plain_text = render(EDITION, "https://r.example", "t")
    assert ">Explained<" not in plain_html and "EXPLAINED" not in plain_text


def explainer_db(handler):
    import httpx

    from kernel.store import Supabase

    seen = []

    def record(request):
        seen.append(request)
        return handler(request)

    db = Supabase("https://proj.supabase.co", "sb_secret_test")
    db.client = httpx.Client(transport=httpx.MockTransport(record), headers=db.client.headers)
    return db, seen


def test_sunday_email_gets_the_approved_explainer_and_other_days_do_not():
    import httpx

    from kernel.send import load_explained

    row = {"slug": "how-sol-works", "title": "How Sol works", "body": {"what_it_is": "Sol is a model.", "steps": []}}
    db, seen = explainer_db(lambda r: httpx.Response(200, json=[row]))
    assert load_explained(db, "2026-11-22") == {"slug": "how-sol-works", "title": "How Sol works", "what_it_is": "Sol is a model."}
    params = dict(seen[0].url.params)
    assert params["status"] == "eq.approved" and params["approved_at"] == "gte.2026-11-15"
    assert load_explained(db, "2026-11-21") is None
    assert len(seen) == 1


def test_missing_explainers_table_does_not_stop_the_sunday_email():
    import httpx

    from kernel.send import load_explained

    db, _ = explainer_db(lambda r: httpx.Response(404, json={"code": "PGRST205"}))
    assert load_explained(db, "2026-11-22") is None
