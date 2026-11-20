import { parseFeedback } from "@/lib/feedback";
import { adminConfigured } from "@/lib/server/admin-db";
import { saveFeedback } from "@/lib/server/feedback";

export async function POST(request: Request) {
  if (!adminConfigured()) {
    return Response.json({ error: "Feedback isn't available on this server." }, { status: 503 });
  }
  const body: unknown = await request.json().catch(() => null);
  if ((body as { company?: unknown } | null)?.company) return Response.json({ id: null });
  const feedback = parseFeedback(body);
  if (!feedback) return Response.json({ error: "That feedback doesn't look right." }, { status: 400 });
  try {
    return Response.json({ id: await saveFeedback(feedback) });
  } catch (err) {
    console.error("[feedback]", err);
    return Response.json({ error: "Something went wrong. Please try again in a minute." }, { status: 500 });
  }
}
