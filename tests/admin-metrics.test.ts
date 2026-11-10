import assert from "node:assert/strict";
import { test } from "node:test";

import { TRIALS_ENDING_DAYS, bucketByWeekUtc, countByEffectivePlan, trialEndingWindow } from "../lib/admin-metrics";

const now = new Date("2026-11-10T12:00:00Z"); // Tuesday

test("trial window ends exactly 7 days after now", () => {
  const w = trialEndingWindow(now);
  assert.equal(TRIALS_ENDING_DAYS, 7);
  assert.equal(w.from.getTime(), now.getTime());
  assert.equal(w.to.getTime(), now.getTime() + 7 * 24 * 60 * 60 * 1000);
});

test("bucketByWeekUtc splits Sunday 23:59 and Monday 00:00 and zero-fills", () => {
  const sunday = new Date("2026-11-08T23:59:00Z");
  const monday = new Date("2026-11-09T00:00:00Z");
  const out = bucketByWeekUtc([sunday, monday, monday], now, 4);
  assert.equal(out.length, 4);
  assert.deepEqual(out.map((b) => b.weekStart.toISOString()), [
    "2026-10-19T00:00:00.000Z",
    "2026-10-26T00:00:00.000Z",
    "2026-11-02T00:00:00.000Z",
    "2026-11-09T00:00:00.000Z"
  ]);
  assert.deepEqual(out.map((b) => b.count), [0, 0, 1, 2]);
});

test("bucketByWeekUtc ignores dates older than the first bucket and future ones", () => {
  const out = bucketByWeekUtc([new Date("2026-10-18T23:59:59Z"), new Date("2026-11-17T00:00:00Z")], now, 4);
  assert.deepEqual(out.map((b) => b.count), [0, 0, 0, 0]);
});

test("countByEffectivePlan applies effective plan rules", () => {
  const past = new Date("2026-11-01T00:00:00Z");
  const future = new Date("2026-11-15T00:00:00Z");
  const out = countByEffectivePlan(
    [
      { plan: "TRIAL", trialEndsAt: past },
      { plan: "TRIAL", trialEndsAt: now },
      { plan: "TRIAL", trialEndsAt: future },
      { plan: "COMP", trialEndsAt: null },
      { plan: "WAT", trialEndsAt: null }
    ],
    now
  );
  assert.deepEqual(out, { TRIAL: 1, STARTER: 0, PRO: 0, AGENCY: 0, COMP: 1, NONE: 3 });
});
