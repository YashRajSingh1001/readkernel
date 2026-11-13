import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/Container";
import { NEWS_TOOLS } from "@/lib/tools";

export const metadata: Metadata = {
  title: "ReadKernel everywhere",
  description: "Get ReadKernel in every new Chrome tab, or plug it into Claude, Cursor and other AI assistants through MCP.",
};

const MCP_URL = "https://readkernel.in/mcp";

// The parts of a tool argument's JSON Schema shown here.
type SchemaProp = { description?: string; enum?: string[] };

const DATA_URLS = [
  { path: "/api/v1/today", what: "Today's brief as JSON: ranked stories with summaries, topics and every source link. Any site may call it (CORS open)." },
  { path: "/rss.xml", what: "RSS: today's brief, one item per story, with its sources linked." },
  { path: "/llms.txt", what: "A Markdown map of the site for AI agents, with today's headlines." },
];

function Code({ children }: { children: string }) {
  return (
    <pre className="mt-2 overflow-x-auto rounded-lg border border-line bg-sunk p-3 font-mono text-[13px] leading-relaxed">
      <code>{children}</code>
    </pre>
  );
}

export default function ToolsPage() {
  return (
    <Container>
      <h1 className="text-4xl title-sans">Take the brief with you</h1>
      <p className="mt-2 text-muted">
        The same brief, wherever you work: in every new browser tab, or inside your AI assistant. Or{" "}
        <Link href="/ask" className="text-accent hover:underline">
          ask it questions
        </Link>{" "}
        right here.
      </p>

      <section className="mt-10" aria-labelledby="ext">
        <h2 id="ext" className="text-2xl font-bold">
          Chrome new tab
        </h2>
        <p className="mt-2 leading-relaxed">
          Every new tab shows today&apos;s ten stories, what developers are discussing and the best company blog posts,
          with a search box that uses your usual search engine. It works offline with the last brief it saw, and it
          reads only ReadKernel&apos;s public news: no account, no tracking.
        </p>
        <p className="mt-3 text-sm text-muted">
          Coming to the Chrome Web Store. Until then, developers can load it from the{" "}
          <code className="font-mono">extension/</code> folder of the source code: open{" "}
          <code className="font-mono">chrome://extensions</code>, turn on Developer mode, click{" "}
          <em>Load unpacked</em> and pick that folder.
        </p>
      </section>

      <section className="mt-12" aria-labelledby="mcp">
        <h2 id="mcp" className="text-2xl font-bold">
          In your AI assistant (MCP)
        </h2>
        <p className="mt-2 leading-relaxed">
          ReadKernel is an MCP server, the standard way AI assistants plug into outside tools. Add it once and ask your
          assistant things like &ldquo;what&apos;s the biggest AI news today?&rdquo; or &ldquo;what has Nvidia announced this
          month?&rdquo;. It answers from ReadKernel&apos;s coverage, with links. Free, no key needed.
        </p>
        <p className="mt-4 font-semibold">Server address</p>
        <Code>{MCP_URL}</Code>

        <p className="mt-6 font-semibold">Claude (claude.ai and the desktop app)</p>
        <p className="mt-1 text-sm text-muted">
          Settings → Connectors → Add custom connector → name it ReadKernel and paste the address above.
        </p>

        <p className="mt-6 font-semibold">Claude Code</p>
        <Code>{`claude mcp add --transport http readkernel ${MCP_URL}`}</Code>

        <p className="mt-6 font-semibold">Cursor, VS Code and others</p>
        <p className="mt-1 text-sm text-muted">Add this to the app&apos;s MCP settings file (for Cursor, mcp.json):</p>
        <Code>{`{
  "mcpServers": {
    "readkernel": { "url": "${MCP_URL}" }
  }
}`}</Code>

        <p className="mt-6 font-semibold">What your assistant can do</p>
        <ul className="mt-2 divide-y divide-line border-y border-line">
          {NEWS_TOOLS.map((t) => (
            <li key={t.name} className="py-3">
              <code className="font-mono text-sm text-accent">{t.name}</code>
              <p className="mt-0.5 text-sm text-muted">{t.description}</p>
              {Object.keys(t.inputSchema.properties).length > 0 && (
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                  {Object.entries(t.inputSchema.properties as Record<string, SchemaProp>).map(([name, p]) => (
                    <div key={name} className="contents">
                      <dt>
                        <code className="font-mono text-[13px]">{name}</code>
                        {t.inputSchema.required?.includes(name) && <span className="text-accent"> *</span>}
                      </dt>
                      <dd className="text-muted">
                        {p.description}
                        {p.enum && <span className="block font-mono text-[12px]">{p.enum.join(" | ")}</span>}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="data">
        <h2 id="data" className="text-2xl font-bold">
          Plain data, for your own scripts and agents
        </h2>
        <p className="mt-2 leading-relaxed">
          No key needed. Please cache: the brief changes once a day.
        </p>
        <dl className="mt-4 divide-y divide-line border-y border-line">
          {DATA_URLS.map((d) => (
            <div key={d.path} className="py-3">
              <dt>
                <a href={d.path} className="font-mono text-sm text-accent hover:underline">
                  {d.path}
                </a>
              </dt>
              <dd className="mt-0.5 text-sm text-muted">{d.what}</dd>
            </div>
          ))}
        </dl>
      </section>
    </Container>
  );
}
