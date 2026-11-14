import { NEWS_TOOLS, runTool } from "@/lib/tools";

const SUPPORTED_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

const INSTRUCTIONS =
  "ReadKernel is a daily tech and AI news brief built from 56 news sources and 30 company engineering blogs. " +
  "Start with get_today_news for today's top stories, search_news for anything older, and get_story for a " +
  "story's full timeline. Always link to the sources the tools return.";

type JsonRpcMessage = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Authorization",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function reply(id: JsonRpcMessage["id"], result: unknown) {
  return { jsonrpc: "2.0", id, result };
}

function failure(id: JsonRpcMessage["id"], code: number, message: string) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

async function handle(msg: JsonRpcMessage) {
  if (!msg || typeof msg !== "object" || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") {
    return failure(msg?.id, -32600, "Invalid request");
  }
  if (msg.id === undefined) return null;

  switch (msg.method) {
    case "initialize": {
      const asked = String(msg.params?.protocolVersion ?? "");
      return reply(msg.id, {
        protocolVersion: SUPPORTED_VERSIONS.includes(asked) ? asked : SUPPORTED_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "readkernel", title: "ReadKernel", version: "1.0.0", websiteUrl: "https://readkernel.in" },
        instructions: INSTRUCTIONS,
      });
    }
    case "ping":
      return reply(msg.id, {});
    case "tools/list":
      return reply(msg.id, {
        tools: NEWS_TOOLS.map((t) => ({
          name: t.name,
          title: t.title,
          description: t.description,
          inputSchema: t.inputSchema,
          annotations: { title: t.title, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
        })),
      });
    case "tools/call": {
      const name = String(msg.params?.name ?? "");
      if (!NEWS_TOOLS.some((t) => t.name === name)) return failure(msg.id, -32602, `Unknown tool: ${name}`);
      const outcome = await runTool(name, msg.params?.arguments);
      return reply(
        msg.id,
        outcome.ok
          ? { content: [{ type: "text", text: JSON.stringify(outcome.result, null, 1) }] }
          : { content: [{ type: "text", text: outcome.error }], isError: true },
      );
    }
    case "resources/list":
      return reply(msg.id, { resources: [] });
    case "prompts/list":
      return reply(msg.id, { prompts: [] });
    default:
      return failure(msg.id, -32601, `Method not found: ${msg.method}`);
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(failure(null, -32700, "Parse error"), { status: 400, headers: CORS });
  }
  const batch = Array.isArray(body);
  const messages = (batch ? body : [body]) as JsonRpcMessage[];
  if (messages.length === 0 || messages.length > 20) {
    return Response.json(failure(null, -32600, "Send 1 to 20 messages"), { status: 400, headers: CORS });
  }
  const answers = (await Promise.all(messages.map(handle))).filter((a) => a !== null);
  if (answers.length === 0) return new Response(null, { status: 202, headers: CORS });
  return Response.json(batch ? answers : answers[0], { headers: CORS });
}

export async function GET() {
  return Response.json(
    {
      name: "ReadKernel MCP server",
      how_to_connect: "Add https://readkernel.in/mcp as a remote MCP server (Streamable HTTP, no key).",
      tools: NEWS_TOOLS.map((t) => t.name),
      docs: "https://readkernel.in/tools",
    },
    { status: 405, headers: { ...CORS, Allow: "POST" } },
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
