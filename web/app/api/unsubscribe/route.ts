import { unsubscribe } from "@/lib/server/subscribers";

export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const result = await unsubscribe(token);
  return new Response(result === "unsubscribed" ? "Unsubscribed" : "Unknown token", {
    status: result === "unsubscribed" ? 200 : 404,
  });
}
