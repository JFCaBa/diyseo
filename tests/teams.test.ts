import assert from "node:assert/strict";
import { test } from "node:test";

import { joinBlocker } from "../lib/teams";
import { inviteMemberSchema } from "../lib/validations";

const empty = {
  articles: 0,
  keywords: 0,
  aiUsage: 0,
  members: 1,
  pendingInvites: 0,
  subscriptionStatus: null,
  pendingCheckoutSessionId: null
};

test("an empty solo workspace can be left", () => {
  assert.equal(joinBlocker(empty), null);
});

test("content blocks joining", () => {
  assert.equal(joinBlocker({ ...empty, articles: 1 }), "has_content");
  assert.equal(joinBlocker({ ...empty, keywords: 1 }), "has_content");
  assert.equal(joinBlocker({ ...empty, aiUsage: 1 }), "has_content");
});

test("a team blocks joining", () => {
  assert.equal(joinBlocker({ ...empty, members: 2 }), "has_team");
  assert.equal(joinBlocker({ ...empty, pendingInvites: 1 }), "has_team");
});

test("a live or pending subscription blocks joining", () => {
  for (const subscriptionStatus of ["active", "incomplete", "past_due"]) {
    assert.equal(joinBlocker({ ...empty, subscriptionStatus }), "has_subscription");
  }
  assert.equal(joinBlocker({ ...empty, pendingCheckoutSessionId: "cs_1" }), "has_subscription");
  assert.equal(joinBlocker({ ...empty, subscriptionStatus: "canceled" }), null);
  assert.equal(joinBlocker({ ...empty, subscriptionStatus: "incomplete_expired" }), null);
});

test("blockers are checked team, then subscription, then content", () => {
  const all = { ...empty, articles: 1, members: 2, subscriptionStatus: "active" };
  assert.equal(joinBlocker(all), "has_team");
  assert.equal(joinBlocker({ ...all, members: 1 }), "has_subscription");
});

test("invite emails are normalized to lower case", () => {
  assert.deepEqual(inviteMemberSchema.parse({ email: "  Ana@Example.COM " }), { email: "ana@example.com" });
  assert.equal(inviteMemberSchema.safeParse({ email: "nope" }).success, false);
});
