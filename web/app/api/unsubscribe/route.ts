import { unsubscribe } from "@/lib/server/subscribers";

// One-click unsubscribe (RFC 8058). Gmail and Outlook call this with a POST
// when the reader presses their built-in "Unsubscribe" button. Only POST
// unsubscribes; a plain GET (link scanners) does nothing.
export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const result = await unsubscribe(token);
  return new Response(result === "unsubscribed" ? "Unsubscribed" : "Unknown token", {
    status: result === "unsubscribed" ? 200 : 404,
  });
}
