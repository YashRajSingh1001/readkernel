import "server-only";

// Supabase REST with the secret key, for private tables (subscribers).
// Server-only: the import above makes the build fail if this ever reaches the browser.

export function adminConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}

export async function adminRest<T = unknown>(
  path: string,
  init: { method?: string; body?: unknown; prefer?: string } = {},
): Promise<T> {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set on the server");

  const headers: Record<string, string> = { apikey: key, "Content-Type": "application/json" };
  if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`; // legacy service_role key
  if (init.prefer) headers.Prefer = init.prefer;

  const res = await fetch(`${url}/rest/v1/${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}
