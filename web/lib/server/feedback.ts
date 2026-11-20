import "server-only";

import type { Feedback } from "@/lib/feedback";
import { adminRest } from "./admin-db";
import { subscriberId } from "./subscribers";

export async function saveFeedback(feedback: Feedback): Promise<string | null> {
  switch (feedback.kind) {
    case "brief_rating": {
      const rows = await adminRest<{ id: string }[]>("feedback?on_conflict=edition_date,subscriber_id&select=id", {
        method: "POST",
        body: {
          kind: "brief_rating",
          edition_date: feedback.date,
          rating: feedback.rating,
          subscriber_id: feedback.token ? await subscriberId(feedback.token) : null,
        },
        prefer: "resolution=merge-duplicates,return=representation",
      });
      return rows[0]?.id ?? null;
    }
    case "story_report":
      await adminRest("feedback", {
        method: "POST",
        body: { kind: "story_report", story_key: feedback.storyKey, edition_date: feedback.date, message: feedback.message },
        prefer: "return=minimal",
      });
      return null;
    case "note":
      await adminRest(`feedback?id=eq.${feedback.id}&kind=eq.brief_rating`, {
        method: "PATCH",
        body: { message: feedback.message },
        prefer: "return=minimal",
      });
      return feedback.id;
  }
}
