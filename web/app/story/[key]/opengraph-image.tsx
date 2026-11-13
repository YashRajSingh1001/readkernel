import { ImageResponse } from "next/og";

import { TOPICS, getStory } from "@/lib/brief";

// The preview card shown when a story link is shared on X, LinkedIn, WhatsApp...
export const alt = "ReadKernel story";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const story = await getStory(key);
  const headline = story?.headline ?? "The day's tech news, distilled";
  const topic = story ? (TOPICS[story.topic] ?? story.topic) : "";
  const sources = story ? new Set(story.sources.map((s) => s.name)).size : 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "#fbfaf6",
          color: "#1b1a17",
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", fontSize: 38 }}>
          <span style={{ fontWeight: 400 }}>read</span>
          <span style={{ fontWeight: 700 }}>kernel</span>
          <span style={{ color: "#c2410c", fontWeight: 700 }}>.</span>
        </div>
        <div style={{ display: "flex", fontSize: headline.length > 90 ? 52 : 64, lineHeight: 1.15, fontWeight: 700 }}>
          {headline}
        </div>
        <div style={{ display: "flex", gap: 24, fontSize: 28, color: "#6b6860", fontFamily: "Arial, sans-serif" }}>
          {topic && <span style={{ color: "#c2410c", fontWeight: 700 }}>{topic}</span>}
          {sources > 1 && <span>{sources} sources</span>}
        </div>
      </div>
    ),
    size,
  );
}
