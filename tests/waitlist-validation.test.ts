import assert from "node:assert/strict";
import { test } from "node:test";

import { parseWaitlistForm } from "../lib/validations";

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

test("normalizes the email", () => {
  assert.deepEqual(parseWaitlistForm(form({ email: " Ana@Empresa.COM " })), { kind: "ok", email: "ana@empresa.com", plan: null });
});

test("rejects a malformed or oversized email", () => {
  assert.deepEqual(parseWaitlistForm(form({ email: "no-email" })), { kind: "invalid" });
  assert.deepEqual(parseWaitlistForm(form({ email: `${"a".repeat(250)}@empresa.com` })), { kind: "invalid" });
  assert.deepEqual(parseWaitlistForm(form({})), { kind: "invalid" });
});

test("treats a filled honeypot as a bot, even with an invalid email", () => {
  assert.deepEqual(parseWaitlistForm(form({ email: "ana@empresa.com", website: "x" })), { kind: "bot" });
  assert.deepEqual(parseWaitlistForm(form({ email: "nope", website: "x" })), { kind: "bot" });
});

test("keeps known plans and drops unknown ones", () => {
  assert.deepEqual(parseWaitlistForm(form({ email: "a@b.co", plan: "pro" })), { kind: "ok", email: "a@b.co", plan: "pro" });
  assert.deepEqual(parseWaitlistForm(form({ email: "a@b.co", plan: "enterprise" })), { kind: "ok", email: "a@b.co", plan: null });
});
