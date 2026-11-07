import assert from "node:assert/strict";
import { test } from "node:test";

import { canSignIn, isListedEmail, planForNewWorkspace } from "../lib/access";

const env = { ALLOWED_EMAILS: " Ana@Example.com, bob@example.com ,," };

test("listed emails match case-insensitively and ignore spaces", () => {
  assert.equal(isListedEmail("ana@example.com", env), true);
  assert.equal(isListedEmail(" BOB@example.com ", env), true);
  assert.equal(isListedEmail("eve@example.com", env), false);
  assert.equal(isListedEmail(null, env), false);
  assert.equal(isListedEmail("", { ALLOWED_EMAILS: "" }), false);
});

test("sign-in stays closed to unlisted emails until SIGNUP_OPEN is true", () => {
  assert.equal(canSignIn("eve@example.com", env), false);
  assert.equal(canSignIn("ana@example.com", env), true);
  assert.equal(canSignIn("eve@example.com", { ...env, SIGNUP_OPEN: "true" }), true);
  assert.equal(canSignIn("eve@example.com", { ...env, SIGNUP_OPEN: "1" }), false);
  assert.equal(canSignIn("eve@example.com", {}), true, "no list and no flag keeps today's open behaviour");
});

test("listed emails get the free plan, everyone else the trial", () => {
  assert.equal(planForNewWorkspace("ana@example.com", env), "COMP");
  assert.equal(planForNewWorkspace("eve@example.com", env), "TRIAL");
});

test("an account without email never signs in", () => {
  assert.equal(canSignIn(null, { SIGNUP_OPEN: "true" }), false);
  assert.equal(canSignIn("  ", {}), false);
});

test("SIGNUP_OPEN=false closes sign-in even with an empty list", () => {
  assert.equal(canSignIn("eve@example.com", { SIGNUP_OPEN: "false" }), false);
  assert.equal(canSignIn("ana@example.com", { ...env, SIGNUP_OPEN: "false" }), true);
});

test("the free plan has no trial end", async () => {
  const { trialEndForPlan } = await import("../lib/access");
  const now = new Date("2026-11-08T00:00:00Z");
  assert.equal(trialEndForPlan("COMP", now), null);
  assert.equal(trialEndForPlan("TRIAL", now)?.toISOString(), "2026-11-15T00:00:00.000Z");
});
