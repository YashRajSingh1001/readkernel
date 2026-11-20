"use client";

import { Analytics } from "@vercel/analytics/next";

// Links in our emails carry the reader's token in the query string, so only the path is reported.
export function VisitCounter() {
  return <Analytics beforeSend={(event) => ({ ...event, url: event.url.split(/[?#]/)[0] })} />;
}
