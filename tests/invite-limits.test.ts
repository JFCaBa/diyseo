import assert from "node:assert/strict";
import { test } from "node:test";

import { createInviteRateLimit } from "../lib/invite-limits";

const MIN = 60 * 1000;
const t0 = 1_800_000_000_000;

test("the same email can be invited once per 10 minutes", () => {
  const allowed = createInviteRateLimit();
  assert.equal(allowed("w1", "a@x.io", t0), true);
  assert.equal(allowed("w1", " A@X.io ", t0 + 9 * MIN), false);
  assert.equal(allowed("w1", "a@x.io", t0 + 10 * MIN), true);
});

test("the per-email window is per workspace", () => {
  const allowed = createInviteRateLimit();
  assert.equal(allowed("w1", "a@x.io", t0), true);
  assert.equal(allowed("w2", "a@x.io", t0), true);
});

test("a workspace can send 20 invites per 24 hours", () => {
  const allowed = createInviteRateLimit();
  for (let i = 0; i < 20; i++) assert.equal(allowed("w1", `u${i}@x.io`, t0 + i), true, `invite ${i}`);
  assert.equal(allowed("w1", "u20@x.io", t0 + 100), false);
  assert.equal(allowed("w2", "u20@x.io", t0 + 100), true);
  assert.equal(allowed("w1", "u21@x.io", t0 + 24 * 60 * MIN), true);
});

test("a refused repeat to the same email does not use the workspace allowance", () => {
  const allowed = createInviteRateLimit();
  assert.equal(allowed("w1", "a@x.io", t0), true);
  for (let i = 0; i < 30; i++) assert.equal(allowed("w1", "a@x.io", t0 + i), false);
  for (let i = 0; i < 19; i++) assert.equal(allowed("w1", `u${i}@x.io`, t0 + i), true, `invite ${i}`);
  assert.equal(allowed("w1", "u19@x.io", t0), false);
});
