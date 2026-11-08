import assert from "node:assert/strict";
import { test } from "node:test";

import { effectivePlan, highestPlan, limitsFor, lookupKey, monthStartUtc, planFromLookupKey } from "../lib/entitlements";
import { PLANS } from "../lib/plans";

const now = new Date("2026-11-10T12:00:00Z");

test("trial is active until trialEndsAt and expired from that instant on", () => {
  assert.equal(effectivePlan({ plan: "TRIAL", trialEndsAt: new Date("2026-11-10T12:00:01Z") }, now), "TRIAL");
  assert.equal(effectivePlan({ plan: "TRIAL", trialEndsAt: now }, now), "NONE");
  assert.equal(effectivePlan({ plan: "TRIAL", trialEndsAt: null }, now), "NONE");
});

test("paid, complimentary and unknown plans", () => {
  assert.equal(effectivePlan({ plan: "PRO", trialEndsAt: null }, now), "PRO");
  assert.equal(effectivePlan({ plan: "COMP", trialEndsAt: null }, now), "COMP");
  assert.equal(effectivePlan({ plan: "ENTERPRISE", trialEndsAt: null }, now), "NONE");
});

test("limits per plan", () => {
  assert.equal(limitsFor("COMP"), null);
  assert.deepEqual(limitsFor("NONE"), { sites: 0, articlesPerMonth: 0, translations: false, members: 1, aiQuestions: 0, adBusinesses: 0 });
  assert.deepEqual(limitsFor("TRIAL"), limitsFor("PRO"));
  assert.deepEqual(limitsFor("STARTER"), { sites: 1, articlesPerMonth: 12, translations: false, members: 1, aiQuestions: 15, adBusinesses: 0 });
  assert.deepEqual(limitsFor("PRO"), { sites: 3, articlesPerMonth: 40, translations: true, members: 3, aiQuestions: 60, adBusinesses: 1 });
  assert.deepEqual(limitsFor("AGENCY"), { sites: 10, articlesPerMonth: 150, translations: true, members: null, aiQuestions: 200, adBusinesses: 10 });
});

test("every catalogued plan carries its limits", () => {
  for (const plan of PLANS) {
    assert.ok(plan.limits.sites > 0 && plan.limits.articlesPerMonth > 0);
  }
});

test("lookup keys round-trip and reject anything else", () => {
  assert.equal(lookupKey("pro", "monthly"), "diyseo_pro_monthly");
  assert.equal(lookupKey("agency", "annual"), "diyseo_agency_annual");
  assert.equal(planFromLookupKey("diyseo_starter_annual"), "starter");
  assert.equal(planFromLookupKey("diyseo_pro_weekly"), null);
  assert.equal(planFromLookupKey("pro_monthly"), null);
  assert.equal(planFromLookupKey(null), null);
  assert.equal(planFromLookupKey(undefined), null);
});

test("highestPlan ignores order", () => {
  assert.equal(highestPlan(["starter", "agency", "pro"]), "agency");
  assert.equal(highestPlan(["pro", "starter"]), "pro");
  assert.equal(highestPlan([]), null);
});

test("monthStartUtc", () => {
  assert.equal(monthStartUtc(new Date("2026-11-30T23:59:00Z")).toISOString(), "2026-11-01T00:00:00.000Z");
  assert.equal(monthStartUtc(new Date("2026-12-01T00:00:00Z")).toISOString(), "2026-12-01T00:00:00.000Z");
});
