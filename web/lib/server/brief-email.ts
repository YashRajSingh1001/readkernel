import "server-only";

// The daily brief email (HTML + plain text). Mirrors pipeline/kernel/newsletter.py,
// so a reader who gets today's brief on confirming sees the same email the
// pipeline sends every morning. Change both together.

import { TOPICS, type Story } from "@/lib/format";

const PAPER = "#fbfaf6";
const INK = "#1b1a17";
const MUTED = "#6b6860";
const LINE = "#e7e4dc";
const ACCENT = "#c2410c";
const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "-apple-system, 'Segoe UI', Arial, sans-serif";
const GOTHIC = "'Century Gothic', CenturyGothic, 'Trebuchet MS', Arial, sans-serif"; // the wordmark

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export type BriefEdition = { date: string; stories: Story[] };

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function parts(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  return { weekday: DAYS[d.getUTCDay()], day: d.getUTCDate(), month: MONTHS[d.getUTCMonth()] };
}

function longDate(iso: string): string {
  const { weekday, day, month } = parts(iso);
  return `${weekday} ${day} ${month}`;
}

function topicLabel(topic: string): string {
  return TOPICS[topic] ?? topic;
}

export function briefLinks(siteUrl: string, token: string) {
  const t = encodeURIComponent(token);
  return {
    unsubscribe: `${siteUrl}/unsubscribe?token=${t}`,
    oneClick: `${siteUrl}/api/unsubscribe?token=${t}`,
    manage: `${siteUrl}/preferences?token=${t}`,
  };
}

export function renderBrief(edition: BriefEdition, siteUrl: string, token: string, fmt = "summaries") {
  const { stories } = edition;
  const urls = briefLinks(siteUrl, token);
  const dayUrl = `${siteUrl}/brief/${edition.date}`;
  const { day, month } = parts(edition.date);
  const subject = `${stories[0]?.headline ?? "Today's brief"} · ReadKernel ${day} ${month.slice(0, 3)}`;
  const showText = fmt !== "headlines";
  const preheader = stories.slice(1, 4).map((s) => s.headline).join(" · ");

  // --- plain text ---------------------------------------------------------
  const lines = [`ReadKernel · Today's brief · ${longDate(edition.date)}`, `${stories.length} stories`, ""];
  stories.forEach((s, i) => {
    lines.push(`${i + 1}. ${s.headline}  [${topicLabel(s.topic)}]`);
    if (showText && s.summary) lines.push(`   ${s.summary}`);
    if (showText && s.why_it_matters) lines.push(`   Why it matters: ${s.why_it_matters}`);
    for (const src of s.sources.slice(0, 4)) lines.push(`   - ${src.name}: ${src.url}`);
    lines.push("");
  });
  lines.push(
    `Read on the web: ${dayUrl}`,
    `Change topics, length or format: ${urls.manage}`,
    `Unsubscribe: ${urls.unsubscribe}`,
  );
  const text = lines.join("\n");

  // --- html ---------------------------------------------------------------
  const cards = stories.map((s, i) => storyHtml(i + 1, s, fmt)).join("");
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:${PAPER};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;">
  <tr><td style="padding:0 8px 20px 8px;border-bottom:1px solid ${LINE};">
    <a href="${esc(siteUrl)}" style="text-decoration:none;color:${INK};font-family:${GOTHIC};font-size:24px;font-weight:normal;">
      read<strong>kernel</strong><span style="color:${ACCENT};">.</span></a>
    <div style="font-family:${SANS};font-size:14px;font-weight:bold;color:${ACCENT};margin-top:18px;">Today's brief</div>
    <div style="font-family:${SERIF};font-size:28px;font-weight:bold;color:${INK};margin-top:4px;">${esc(longDate(edition.date))}</div>
    <div style="font-family:${SANS};font-size:14px;color:${MUTED};margin-top:6px;">${stories.length} stories worth your time.</div>
  </td></tr>
  ${cards}
  <tr><td style="padding:24px 8px;border-top:1px solid ${LINE};font-family:${SANS};font-size:12px;line-height:1.6;color:${MUTED};">
    <a href="${esc(dayUrl)}" style="color:${INK};">Read this brief on the web</a><br>
    You're getting this because you subscribed to ReadKernel.
    <a href="${esc(urls.manage)}" style="color:${MUTED};">Change topics or format</a> &nbsp;·&nbsp;
    <a href="${esc(urls.unsubscribe)}" style="color:${MUTED};">Unsubscribe</a>
  </td></tr>
</table></td></tr></table></body></html>`;

  // Lets Gmail/Outlook show their own "Unsubscribe" button (RFC 8058).
  const headers = {
    "List-Unsubscribe": `<${urls.oneClick}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
  return { subject, html, text, headers };
}

function storyHtml(rank: number, story: Story, fmt: string): string {
  const sources = story.sources;
  const leadUrl = sources[0]?.url ?? "";
  let headline = esc(story.headline);
  if (leadUrl) headline = `<a href="${esc(leadUrl)}" style="color:${INK};text-decoration:none;">${headline}</a>`;
  const names = [...new Set(sources.map((s) => s.name))];
  const meta = names.length > 1 ? `${names.length} sources` : (names[0] ?? "");
  const showText = fmt !== "headlines";
  const summary =
    showText && story.summary
      ? `<p style="margin:8px 0 0 0;font-family:${SANS};font-size:15px;line-height:1.55;color:${INK};">${esc(story.summary)}</p>`
      : "";
  let image = "";
  if (fmt === "images" && story.image_url) {
    const credit = story.image_credit ? `Image: ${esc(story.image_credit)}` : "";
    image =
      `<img src="${esc(story.image_url)}" alt="" width="560" ` +
      `style="display:block;width:100%;max-width:560px;height:auto;border-radius:8px;margin:10px 0 4px 0;">` +
      `<div style="font-family:${SANS};font-size:11px;color:${MUTED};">${credit}</div>`;
  }
  const why =
    showText && story.why_it_matters
      ? `<p style="margin:10px 0 0 0;padding-left:10px;border-left:2px solid ${ACCENT};font-family:${SANS};font-size:13px;line-height:1.5;color:${MUTED};">` +
        `<strong style="color:${INK};">Why it matters:</strong> ${esc(story.why_it_matters)}</p>`
      : "";
  const sourceLinks = sources
    .slice(0, 4)
    .map((s) => `<a href="${esc(s.url)}" style="color:${MUTED};">${esc(s.name)}</a>`)
    .join(" &nbsp;·&nbsp; ");
  return `
  <tr><td style="padding:20px 8px;border-bottom:1px solid ${LINE};">
    <div style="font-family:${SANS};font-size:12px;color:${MUTED};">
      <span style="color:${ACCENT};font-weight:bold;">${rank}. ${esc(topicLabel(story.topic))}</span> &nbsp;·&nbsp; ${esc(meta)}
    </div>
    <div style="margin-top:6px;font-family:${SERIF};font-size:20px;line-height:1.3;font-weight:bold;">${headline}</div>
    ${image}${summary}${why}
    <div style="margin-top:10px;font-family:${SANS};font-size:12px;">${sourceLinks}</div>
  </td></tr>`;
}
