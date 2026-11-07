import assert from "node:assert/strict";
import { test } from "node:test";

import { automaticTaxEnabled, checkoutTaxParams, projectPlan } from "../lib/billing-rules";

const now = new Date("2026-11-10T12:00:00Z");
const future = new Date("2026-11-15T00:00:00Z");
const past = new Date("2026-11-01T00:00:00Z");

test("COMP is never changed by Stripe", () => {
  const result = projectPlan({ current: "COMP", trialEndsAt: null, subs: [{ status: "active", lookupKey: "diyseo_pro_monthly" }] }, now);
  assert.equal(result.plan, "COMP");
});

test("no subscription keeps a live trial and ends an expired one", () => {
  assert.deepEqual(projectPlan({ current: "TRIAL", trialEndsAt: future, subs: [] }, now), { plan: "TRIAL", status: null, duplicate: false });
  assert.deepEqual(projectPlan({ current: "PRO", trialEndsAt: past, subs: [] }, now), { plan: "NONE", status: null, duplicate: false });
});

test("canceled or incomplete subscriptions grant nothing", () => {
  const subs = [
    { status: "canceled", lookupKey: "diyseo_agency_monthly" },
    { status: "incomplete", lookupKey: "diyseo_pro_monthly" }
  ];
  assert.equal(projectPlan({ current: "AGENCY", trialEndsAt: null, subs }, now).plan, "NONE");
});

test("past_due keeps the plan and reports its status", () => {
  assert.deepEqual(projectPlan({ current: "PRO", trialEndsAt: null, subs: [{ status: "past_due", lookupKey: "diyseo_pro_annual" }] }, now), {
    plan: "PRO",
    status: "past_due",
    duplicate: false
  });
});

test("two live subscriptions: highest plan wins and the duplicate is flagged", () => {
  const subs = [
    { status: "active", lookupKey: "diyseo_starter_monthly" },
    { status: "trialing", lookupKey: "diyseo_agency_annual" }
  ];
  assert.deepEqual(projectPlan({ current: "TRIAL", trialEndsAt: future, subs }, now), { plan: "AGENCY", status: "trialing", duplicate: true });
});

test("a subscription to an unknown price is ignored", () => {
  assert.equal(projectPlan({ current: "TRIAL", trialEndsAt: future, subs: [{ status: "active", lookupKey: "other_price" }] }, now).plan, "TRIAL");
});

test("automatic tax switch and Checkout params", () => {
  assert.equal(automaticTaxEnabled({ STRIPE_AUTOMATIC_TAX: "true" }), true);
  assert.equal(automaticTaxEnabled({ STRIPE_AUTOMATIC_TAX: "1" }), false);
  assert.deepEqual(checkoutTaxParams(false, true), {});
  assert.deepEqual(checkoutTaxParams(true, false), {
    automatic_tax: { enabled: true },
    tax_id_collection: { enabled: true },
    billing_address_collection: "required"
  });
  assert.deepEqual((checkoutTaxParams(true, true) as { customer_update?: unknown }).customer_update, { address: "auto", name: "auto" });
});
