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
    assert "&lt;b&gt;buys&lt;/b&gt; rival &amp; co" in html  # no raw HTML from feeds
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
    assert "List-Unsubscribe" not in test_msg.headers  # test sends have no real token


def test_preview_mailer_writes_a_valid_email(tmp_path):
    mailer = PreviewMailer("ReadKernel <news@readkernel.example>", tmp_path)
    mailer.send(message_for(EDITION, "Reader@Example.com", "tok", "https://r.example"))
    files = list(tmp_path.glob("*.eml"))
    assert len(files) == 1
    parsed = message_from_bytes(files[0].read_bytes())
    assert parsed["To"] == "Reader@Example.com"
    assert parsed["List-Unsubscribe-Post"] == "List-Unsubscribe=One-Click"
    assert {p.get_content_type() for p in parsed.walk()} >= {"text/plain", "text/html"}
