import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import {
  AUTO_POST_SCRIPT,
  autoPostHeaders,
  autoPostHtml,
  decideAuthorize,
  safeLoginNext,
  type AuthorizeInput,
} from "../lib/sso/authorize";
import type { SsoService } from "../lib/sso/services";

const ads: SsoService = { name: "ads", callbackUrl: "https://ads.example/sso/callback", secret: "x".repeat(32) };
const mcp: SsoService = { name: "mcp", callbackUrl: "https://mcp.example/sso/callback", secret: "y".repeat(32) };

const base: AuthorizeInput = {
  service: ads,
  state: "abc",
  session: { userId: "u1", email: "a@b.co", name: "Ana" },
  membership: { id: "m1", workspaceId: "w1", role: "OWNER" },
  plan: "PRO",
  requestPathAndQuery: "/sso/authorize?service=ads&state=abc",
};

test("unknown or disabled service is not found", () => {
  assert.deepEqual(decideAuthorize({ ...base, service: null }), { kind: "not_found" });
});

test("missing, empty or oversized state is a bad request", () => {
  assert.deepEqual(decideAuthorize({ ...base, state: null }), { kind: "bad_request" });
  assert.deepEqual(decideAuthorize({ ...base, state: "" }), { kind: "bad_request" });
  assert.deepEqual(decideAuthorize({ ...base, state: "s".repeat(201) }), { kind: "bad_request" });
  assert.equal(decideAuthorize({ ...base, state: "s".repeat(200) }).kind, "pass");
});

test("no session sends to login with the relative authorize URL, which /sso/login accepts", () => {
  const decision = decideAuthorize({ ...base, session: null, membership: null });
  assert.deepEqual(decision, { kind: "login", next: "/sso/authorize?service=ads&state=abc" });
  assert.equal(safeLoginNext(decision.kind === "login" ? decision.next : ""), "/sso/authorize?service=ads&state=abc");
});

test("/sso/login only goes back to /sso/authorize", () => {
  assert.equal(safeLoginNext("https://evil.example/sso/authorize?x"), "/");
  assert.equal(safeLoginNext("//evil.example/sso/authorize?x"), "/");
  assert.equal(safeLoginNext("/billing"), "/");
  assert.equal(safeLoginNext("/sso/authorize"), "/");
  assert.equal(safeLoginNext(undefined), "/");
});

test("signed in with no membership is a bad request", () => {
  assert.deepEqual(decideAuthorize({ ...base, membership: null }), { kind: "bad_request" });
});

test("STARTER asking for ads must upgrade", () => {
  assert.deepEqual(decideAuthorize({ ...base, plan: "STARTER" }), { kind: "upgrade", service: "ads", role: "OWNER" });
});

test("NONE asking for mcp must upgrade, and the role is carried", () => {
  const membership = { id: "m2", workspaceId: "w1", role: "MEMBER" as const };
  assert.deepEqual(decideAuthorize({ ...base, service: mcp, plan: "NONE", membership }), {
    kind: "upgrade",
    service: "mcp",
    role: "MEMBER",
  });
});

test("PRO asking for ads gets a pass for the registered callback, ignoring return_to", () => {
  const decision = decideAuthorize({
    ...base,
    requestPathAndQuery: "/sso/authorize?service=ads&state=abc&return_to=https://evil.example",
  });
  assert.equal(decision.kind, "pass");
  if (decision.kind !== "pass") return;
  assert.equal(decision.callbackUrl, "https://ads.example/sso/callback");
  assert.deepEqual(decision.claims, {
    sub: "u1",
    email: "a@b.co",
    name: "Ana",
    wid: "w1",
    mid: "m1",
    role: "OWNER",
    plan: "PRO",
    grant: { mcp: true, ads: true, aiQuestions: 60, adBusinesses: 1 },
    state: "abc",
  });
});

test("autoPostHtml escapes every value", () => {
  const html = autoPostHtml('https://ads.example/cb?a=1&b="2"', { pass: "p.q.r", state: `"><script>alert('x')</script>` });
  assert.ok(!html.includes("<script>alert"));
  assert.ok(html.includes("&quot;&gt;&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;"));
  assert.ok(html.includes('action="https://ads.example/cb?a=1&amp;b=&quot;2&quot;"'));
  assert.ok(html.includes('name="pass" value="p.q.r"'));
  assert.ok(html.includes('<noscript><button type="submit">Continue</button></noscript>'));
  assert.equal(html.split("<script>").length, 2);
  assert.ok(html.includes(`<script>${AUTO_POST_SCRIPT}</script>`));
});

test("auto-POST headers pin the script hash and the callback origin", () => {
  const headers = autoPostHeaders("https://ads.example:8443/sso/callback?x=1");
  const hash = createHash("sha256").update(AUTO_POST_SCRIPT).digest("base64");
  assert.equal(headers["Cache-Control"], "no-store");
  assert.equal(headers["Referrer-Policy"], "no-referrer");
  const csp = headers["Content-Security-Policy"];
  assert.ok(csp.startsWith("default-src 'none';"));
  assert.ok(csp.includes("form-action https://ads.example:8443;"));
  assert.ok(csp.includes(`script-src 'sha256-${hash}'`));
  assert.ok(csp.endsWith("frame-ancestors 'self'"));
});
