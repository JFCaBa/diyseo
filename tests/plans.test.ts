import assert from "node:assert/strict";
import { test } from "node:test";

import { isPlanId, PLANS } from "../lib/plans";

test("prices match the spec", () => {
  assert.deepEqual(
    PLANS.map((plan) => [plan.id, plan.monthlyPrice, plan.annualMonthlyPrice]),
    [
      ["starter", 29, 23],
      ["pro", 79, 63],
      ["agency", 199, 159]
    ]
  );
});

test("annual price is the monthly price minus 20%", () => {
  for (const plan of PLANS) {
    assert.equal(plan.annualMonthlyPrice, Math.round(plan.monthlyPrice * 0.8));
  }
});

test("no plan promises unlimited usage", () => {
  for (const feature of PLANS.flatMap((plan) => plan.features)) {
    assert.doesNotMatch(feature, /unlimited/i);
  }
});

test("isPlanId only accepts catalogued plans", () => {
  assert.equal(isPlanId("pro"), true);
  assert.equal(isPlanId("enterprise"), false);
  assert.equal(isPlanId(null), false);
});
