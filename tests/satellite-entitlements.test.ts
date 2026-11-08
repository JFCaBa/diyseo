import assert from "node:assert/strict";
import { test } from "node:test";

import { satelliteGrant, memberLimit } from "../lib/satellite-entitlements";

test("satellite grant per plan matches the spec table", () => {
  assert.deepEqual(satelliteGrant("TRIAL"), { mcp: true, ads: true, aiQuestions: 60, adBusinesses: 1 });
  assert.deepEqual(satelliteGrant("STARTER"), { mcp: true, ads: false, aiQuestions: 15, adBusinesses: 0 });
  assert.deepEqual(satelliteGrant("PRO"), { mcp: true, ads: true, aiQuestions: 60, adBusinesses: 1 });
  assert.deepEqual(satelliteGrant("AGENCY"), { mcp: true, ads: true, aiQuestions: 200, adBusinesses: 10 });
  assert.deepEqual(satelliteGrant("COMP"), { mcp: true, ads: true, aiQuestions: null, adBusinesses: null });
  assert.deepEqual(satelliteGrant("NONE"), { mcp: false, ads: false, aiQuestions: 0, adBusinesses: 0 });
});

test("member limit per plan", () => {
  assert.equal(memberLimit("STARTER"), 1);
  assert.equal(memberLimit("PRO"), 3);
  assert.equal(memberLimit("TRIAL"), 3);
  assert.equal(memberLimit("AGENCY"), null);
  assert.equal(memberLimit("COMP"), null);
  assert.equal(memberLimit("NONE"), 1);
});
