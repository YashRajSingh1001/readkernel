import assert from "node:assert/strict";
import { register } from "node:module";
import test, { type TestContext } from "node:test";

register("./test-support/server-loader.mjs", import.meta.url);
const { subscribe } = await import("./server/subscribers.ts");
const { signupState } = await import("./signup.ts");

const EMAIL = "reader@example.com";
const SUBJECT = "Confirm your ReadKernel subscription";
const LONG_AGO = "2026-01-01T00:00:00.000Z";

type Row = { id: string; email: string; status: string; token: string; confirm_sent_at: string | null };

function fixture(t: TestContext, rows: Row[]) {
  const env = {
    SUPABASE_URL: "https://database.invalid", SUPABASE_SECRET_KEY: "test-admin",
    SITE_URL: "https://readkernel.invalid", EMAIL_TRANSPORT: "preview",
  };
  for (const [key, value] of Object.entries(env)) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
  const mail: string[] = [];
  t.mock.method(console, "log", (line: string) => mail.push(line));
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.hostname !== "database.invalid" || url.pathname !== "/rest/v1/subscribers") {
      throw new Error(`Unexpected request: ${url}`);
    }
    const method = init?.method ?? "GET";
    if (method === "GET") {
      return Response.json(rows.filter((r) => `eq.${r.email}` === url.searchParams.get("email")));
    }
    const body = JSON.parse(String(init?.body));
    if (method === "POST") rows.push({ id: crypto.randomUUID(), ...body });
    else if (method === "PATCH") Object.assign(rows.find((r) => `eq.${r.id}` === url.searchParams.get("id"))!, body);
    else throw new Error(`Unexpected ${method} ${url}`);
    return new Response(null, { status: 204 });
  });
  return mail;
}

async function submitTwice(t: TestContext, rows: Row[]) {
  const mail = fixture(t, rows);
  const first = await subscribe(EMAIL);
  const second = await subscribe(EMAIL);
  return { results: [first, second], states: [signupState(EMAIL, first, false), signupState(EMAIL, second, true)], mail };
}

test("a new address and an active one show the same screens on signup and on an immediate resend", async (t) => {
  const fresh = await submitTwice(t, []);
  const active = await submitTwice(t, [
    { id: "a1", email: EMAIL, status: "active", token: "active-token-0000000000", confirm_sent_at: LONG_AGO },
  ]);

  assert.deepEqual(fresh.results, ["sent", "cooldown"]);
  assert.deepEqual(active.results, ["already_active", "cooldown"]);
  assert.deepEqual(fresh.states, active.states);

  const [signedUp, cooldown] = fresh.states;
  assert.ok(signedUp?.ok);
  assert.match(signedUp.message, new RegExp(`${EMAIL}.*from ReadKernel.*"${SUBJECT}"`));
  assert.match(signedUp.message, /spam or promotions/);
  assert.equal(signedUp.notice, undefined);
  assert.ok(cooldown?.ok);
  assert.equal(cooldown.notice, "We just sent one. You can ask again in a few minutes.");

  assert.equal(fresh.mail.length, 1);
  assert.match(fresh.mail[0], new RegExp(`to=${EMAIL} subject="${SUBJECT}"`));
  assert.match(fresh.mail[0], /https:\/\/readkernel\.invalid\/confirm\?token=[\w-]{16,}/);
  assert.match(fresh.mail[0], /If you didn't sign up, ignore this email\./);
  assert.equal(active.mail.length, 1);
  assert.match(active.mail[0], /subject="Change your ReadKernel brief"/);
  assert.match(active.mail[0], /\/preferences\?token=active-token-0000000000/);
});

test("a resend after the cooldown sends the same confirmation link again", async (t) => {
  const elevenMinutesAgo = new Date(Date.now() - 11 * 60 * 1000).toISOString();
  const rows = [{ id: "p1", email: EMAIL, status: "pending", token: "pending-token-000000000", confirm_sent_at: elevenMinutesAgo }];
  const mail = fixture(t, rows);

  const result = await subscribe(EMAIL);

  assert.equal(result, "sent");
  const resent = signupState(EMAIL, result, true);
  assert.ok(resent?.ok);
  assert.equal(resent.notice, "Sent again.");
  assert.equal(mail.length, 1);
  assert.match(mail[0], /\/confirm\?token=pending-token-000000000/);
  assert.notEqual(rows[0].confirm_sent_at, elevenMinutesAgo);
});
