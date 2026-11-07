import assert from "node:assert/strict";
import { test } from "node:test";

import { countsTowardQuota, PENDING_CREDIT_TTL_MS } from "../lib/quota";

const now = new Date("2026-11-10T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);

test("committed credits always count", () => {
  assert.equal(countsTowardQuota({ status: "COMMITTED", createdAt: ago(PENDING_CREDIT_TTL_MS * 10) }, now), true);
});

test("a pending reservation counts only while it is fresh", () => {
  assert.equal(countsTowardQuota({ status: "PENDING", createdAt: ago(PENDING_CREDIT_TTL_MS - 1) }, now), true);
  assert.equal(countsTowardQuota({ status: "PENDING", createdAt: ago(PENDING_CREDIT_TTL_MS) }, now), false);
});

test("unknown statuses never count", () => {
  assert.equal(countsTowardQuota({ status: "WEIRD", createdAt: now }, now), false);
});
