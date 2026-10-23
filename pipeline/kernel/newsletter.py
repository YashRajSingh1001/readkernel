"""Turn a day's edition into the daily email (HTML + plain text).

Email clients ignore most modern CSS, so the HTML uses tables and inline
styles, and fonts fall back to Georgia/Arial.

web/lib/server/brief-email.ts renders the same email for readers who confirm
after the day's brief has gone out. Change both together.
"""

from __future__ import annotations

from datetime import date
from html import escape
from urllib.parse import quote

TOPIC_LABELS = {
    "ai": "AI",
    "tech": "Tech",
    "dev": "Developers",
    "startups": "Startups",
    "security": "Security",
    "markets": "Markets",
    "design": "Design",
}

PAPER = "#fbfaf6"
CARD = "#ffffff"
INK = "#1b1a17"
MUTED = "#6b6860"
LINE = "#e7e4dc"
ACCENT = "#c2410c"
SERIF = "Georgia, 'Times New Roman', serif"
SANS = "-apple-system, 'Segoe UI', Arial, sans-serif"


def long_date(iso: str) -> str:
    d = date.fromisoformat(iso)
    return f"{d.strftime('%A')} {d.day} {d.strftime('%B')}"


def links(site_url: str, token: str | None) -> dict[str, str]:
    unsubscribe = f"{site_url}/unsubscribe?token={quote(token)}" if token else f"{site_url}/unsubscribe"
    one_click = f"{site_url}/api/unsubscribe?token={quote(token)}" if token else ""
    manage = f"{site_url}/preferences?token={quote(token)}" if token else f"{site_url}/brief/customize"
    return {"unsubscribe": unsubscribe, "one_click": one_click, "manage": manage}


def subject_line(edition: dict) -> str:
    stories = edition["stories"]
    top = stories[0]["headline"] if stories else "Today's brief"
    d = date.fromisoformat(edition["date"])
    if edition.get("weekly"):
        return f"The week in tech: {top} · ReadKernel"
    return f"{top} · ReadKernel {d.day} {d.strftime('%b')}"


def render(
    edition: dict, site_url: str, token: str | None = None, fmt: str = "summaries"
) -> tuple[str, str, str]:
    """Return (subject, html, text).

    fmt: "summaries" (default), "headlines" (titles only) or "images" (summaries + photo).
    """
    stories = edition["stories"]
    weekly = bool(edition.get("weekly"))
    urls = links(site_url, token)
    day_url = f"{site_url}/brief/{edition['date']}"
    subject = subject_line(edition)
    label = "This week" if weekly else "Today's brief"
    show_text = fmt != "headlines"
    preheader = " · ".join(s["headline"] for s in stories[1:4])

    # --- plain text -------------------------------------------------------
    lines = [f"ReadKernel · {label} · {long_date(edition['date'])}", f"{len(stories)} stories", ""]
    for i, s in enumerate(stories, 1):
        lines.append(f"{i}. {s['headline']}  [{TOPIC_LABELS.get(s['topic'], s['topic'])}]")
        if show_text and s.get("summary"):
            lines.append(f"   {s['summary']}")
        if show_text and s.get("why_it_matters"):
            lines.append(f"   Why it matters: {s['why_it_matters']}")
        for src in s["sources"][:4]:
            lines.append(f"   - {src['name']}: {src['url']}")
        lines.append("")
    lines += [
        f"Read on the web: {day_url}",
        f"Change topics, length or format: {urls['manage']}",
        f"Unsubscribe: {urls['unsubscribe']}",
    ]
    text = "\n".join(lines)

    # --- html -------------------------------------------------------------
    cards = "".join(_story_html(i, s, fmt) for i, s in enumerate(stories, 1))
    html = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><title>{escape(subject)}</title></head>
<body style="margin:0;padding:0;background:{PAPER};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">{escape(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{PAPER};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;">
  <tr><td style="padding:0 8px 20px 8px;border-bottom:1px solid {LINE};">
    <a href="{escape(site_url)}" style="text-decoration:none;color:{INK};font-family:{SERIF};font-size:24px;font-weight:bold;">
      <span style="color:{ACCENT};">&#9679;</span> ReadKernel</a>
    <div style="font-family:{SANS};font-size:12px;letter-spacing:1px;text-transform:uppercase;color:{ACCENT};margin-top:18px;">{label}</div>
    <div style="font-family:{SERIF};font-size:28px;font-weight:bold;color:{INK};margin-top:4px;">{escape(long_date(edition['date']))}</div>
    <div style="font-family:{SANS};font-size:14px;color:{MUTED};margin-top:6px;">{len(stories)} stories worth your time.</div>
  </td></tr>
  {cards}
  <tr><td style="padding:24px 8px;border-top:1px solid {LINE};font-family:{SANS};font-size:12px;line-height:1.6;color:{MUTED};">
    <a href="{escape(day_url)}" style="color:{INK};">Read this brief on the web</a><br>
    You're getting this because you subscribed to ReadKernel.
    <a href="{escape(urls['manage'])}" style="color:{MUTED};">Change topics or format</a> &nbsp;·&nbsp;
    <a href="{escape(urls['unsubscribe'])}" style="color:{MUTED};">Unsubscribe</a>
  </td></tr>
</table></td></tr></table></body></html>"""
    return subject, html, text


def _story_html(rank: int, story: dict, fmt: str = "summaries") -> str:
    sources = story["sources"]
    lead_url = sources[0]["url"] if sources else ""
    headline = escape(story["headline"])
    if lead_url:
        headline = f'<a href="{escape(lead_url)}" style="color:{INK};text-decoration:none;">{headline}</a>'
    names = list(dict.fromkeys(s["name"] for s in sources))
    meta = f"{len(names)} sources" if len(names) > 1 else (names[0] if names else "")
    show_text = fmt != "headlines"
    summary = (
        f'<p style="margin:8px 0 0 0;font-family:{SANS};font-size:15px;line-height:1.55;color:{INK};">{escape(story["summary"])}</p>'
        if show_text and story.get("summary")
        else ""
    )
    image = ""
    if fmt == "images" and story.get("image_url"):
        credit = f"Image: {escape(story['image_credit'])}" if story.get("image_credit") else ""
        image = (
            f'<img src="{escape(story["image_url"])}" alt="" width="560" '
            f'style="display:block;width:100%;max-width:560px;height:auto;border-radius:8px;margin:10px 0 4px 0;">'
            f'<div style="font-family:{SANS};font-size:11px;color:{MUTED};">{credit}</div>'
        )
    why = (
        f'<p style="margin:10px 0 0 0;padding-left:10px;border-left:2px solid {ACCENT};font-family:{SANS};font-size:13px;line-height:1.5;color:{MUTED};">'
        f'<strong style="color:{INK};">Why it matters:</strong> {escape(story["why_it_matters"])}</p>'
        if show_text and story.get("why_it_matters")
        else ""
    )
    source_links = " &nbsp;·&nbsp; ".join(
        f'<a href="{escape(s["url"])}" style="color:{MUTED};">{escape(s["name"])}</a>' for s in sources[:4]
    )
    return f"""
  <tr><td style="padding:20px 8px;border-bottom:1px solid {LINE};">
    <div style="font-family:{SANS};font-size:12px;color:{MUTED};">
      <span style="color:{ACCENT};font-weight:bold;">{rank}. {escape(TOPIC_LABELS.get(story['topic'], story['topic']))}</span> &nbsp;·&nbsp; {escape(meta)}
    </div>
    <div style="margin-top:6px;font-family:{SERIF};font-size:20px;line-height:1.3;font-weight:bold;">{headline}</div>
    {image}{summary}{why}
    <div style="margin-top:10px;font-family:{SANS};font-size:12px;">{source_links}</div>
  </td></tr>"""
