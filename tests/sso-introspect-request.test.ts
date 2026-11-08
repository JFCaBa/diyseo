import assert from "node:assert/strict";
import { test } from "node:test";
import { parseIntrospectRequest } from "../lib/sso/introspect-request";

const env = { SSO_MCP_CALLBACK_URL: "https://mcp.example/cb", SSO_MCP_SECRET: "m".repeat(32) };
const bearer = `Bearer ${"m".repeat(32)}`;

test("missing or wrong secret is unauthorized", () => {
  for (const h of [null, "", "Bearer nope", `Basic ${"m".repeat(32)}`, `Bearer ${"x".repeat(32)}`]) {
    assert.deepEqual(parseIntrospectRequest("sub", h, '{"sub":"u"}', env), { ok: false, status: 401, error: "unauthorized" });
  }
});

test("a valid secret and body yield the service and value", () => {
  const r = parseIntrospectRequest("sub", bearer, '{"sub":"u1"}', env);
  assert.ok(r.ok);
  assert.equal(r.ok && r.service.name, "mcp");
  assert.equal(r.ok && r.value, "u1");
  const w = parseIntrospectRequest("wid", bearer, '{"wid":"w1"}', env);
  assert.ok(w.ok && w.value === "w1");
});

test("invalid JSON or shape is a 400", () => {
  for (const body of ["not json", "{}", '{"sub":""}', `{"sub":"${"a".repeat(65)}"}`, '{"sub":1}', '{"sub":"u","x":1}', '{"wid":"w"}', "null"]) {
    assert.deepEqual(parseIntrospectRequest("sub", bearer, body, env), { ok: false, status: 400, error: "bad_request" });
  }
});
