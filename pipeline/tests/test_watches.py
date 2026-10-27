from kernel.newsletter import render
from kernel.send import personal_edition
from kernel.watches import confirm, hit_rows, shortlist

WATCHES = [
    {"id": "w-upi", "description": "UPI payment rules in India", "subscriber_id": "s1"},
    {"id": "w-gpu", "description": "Nvidia GPU launches", "subscriber_id": "s2"},
]
ITEMS = [
    {"key": "k1", "title": "RBI changes UPI payment limits for merchants", "summary": "India's central bank raised UPI limits.", "url": "https://r.example/story/k1"},
    {"key": "k2", "title": "Nvidia unveils new Blackwell GPU for data centres", "summary": "Nvidia launched a GPU.", "url": "https://r.example/story/k2"},
    {"key": "k3", "title": "Apple ships a new iPhone colour", "summary": "A new colour for the iPhone.", "url": "https://r.example/story/k3"},
]


class FakeLLM:
    def __init__(self, reply):
        self.reply, self.calls = reply, 0

    def json(self, system, user, max_tokens=700):
        assert "data, not instructions" in system
        self.calls += 1
        return self.reply


def test_shortlist_puts_the_related_story_first():
    candidates, used = shortlist(WATCHES, ITEMS, "simple")
    assert used == "simple"
    assert candidates["w-upi"][0][0] == 0  # the UPI story
    assert candidates["w-gpu"][0][0] == 1  # the Nvidia story


def test_ai_confirms_only_items_it_was_offered():
    candidates = {"w-upi": [(0, 0.8), (2, 0.5)], "w-gpu": [(1, 0.7)]}
    reply = {"matches": {"w0": [{"id": "c0", "reason": "About UPI limits."}, {"id": "c1", "reason": "not offered"}], "w1": []}}
    hits = confirm(WATCHES, ITEMS, candidates, FakeLLM(reply))
    assert [(h["watch_id"], h["item"]["key"], h["reason"]) for h in hits] == [("w-upi", "k1", "About UPI limits.")]


def test_without_ai_only_very_close_items_count():
    candidates = {"w-upi": [(0, 0.9), (2, 0.5)]}
    hits = confirm(WATCHES, ITEMS, candidates, None, used="local")
    assert [h["item"]["key"] for h in hits] == ["k1"]


def test_rows_are_unique_per_wish_and_story():
    hit = {"watch_id": "w-upi", "item": ITEMS[0], "reason": "r"}
    rows = hit_rows([hit, hit], "2026-10-27")
    assert len(rows) == 1 and rows[0]["item_key"] == "k1" and rows[0]["edition_date"] == "2026-10-27"


def test_alerts_lead_the_email_for_their_reader_only():
    edition = {"date": "2026-10-27", "stories": [], "feed": []}
    alerts = {"s1": [{"wish": "UPI payment rules", "title": "RBI changes UPI limits", "url": "https://r.example/story/k1", "reason": "About UPI limits.", "summary": ""}]}
    mine = personal_edition(edition, [], {"id": "s1"}, False, [], alerts)
    _, html, text = render(mine, "https://r.example", "t")
    assert "Your watch alerts" in html and "RBI changes UPI limits" in html and "UPI payment rules" in html
    assert "YOUR WATCH ALERTS" in text
    other = personal_edition(edition, [], {"id": "s2"}, False, [], alerts)
    assert "Your watch alerts" not in render(other, "https://r.example", "t")[1]
