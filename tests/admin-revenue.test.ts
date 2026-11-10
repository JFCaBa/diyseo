import assert from "node:assert/strict";
import { test } from "node:test";

import { collectPaged, createNegativeCache, createTtlCache, planFromPrice, estimateMonthlyFromPlans, formatMinor, netRevenueByCurrency } from "../lib/admin-revenue";

const charge = (over: Partial<{ amount: number; amountRefunded: number; paid: boolean; currency: string }> = {}) => ({
  amount: 2900,
  amountRefunded: 0,
  paid: true,
  currency: "gbp",
  ...over
});

test("two currencies are summed separately and sorted", () => {
  const out = netRevenueByCurrency([
    charge({ currency: "usd", amount: 1000 }),
    charge({ currency: "gbp", amount: 2900 }),
    charge({ currency: "gbp", amount: 7900 })
  ]);
  assert.deepEqual(out, [
    { currency: "gbp", amountMinor: 10800 },
    { currency: "usd", amountMinor: 1000 }
  ]);
});

test("a partial refund subtracts", () => {
  assert.deepEqual(netRevenueByCurrency([charge({ amountRefunded: 900 })]), [{ currency: "gbp", amountMinor: 2000 }]);
});

test("a fully refunded charge contributes 0", () => {
  assert.deepEqual(netRevenueByCurrency([charge({ amountRefunded: 2900 })]), [{ currency: "gbp", amountMinor: 0 }]);
});

test("an unpaid charge is ignored", () => {
  assert.deepEqual(netRevenueByCurrency([charge({ paid: false })]), []);
});

test("an empty list gives []", () => {
  assert.deepEqual(netRevenueByCurrency([]), []);
});

test("a refund larger than the amount cannot go negative", () => {
  assert.deepEqual(netRevenueByCurrency([charge({ amountRefunded: 5000 })]), [{ currency: "gbp", amountMinor: 0 }]);
});

test("estimateMonthlyFromPlans multiplies counts by plan prices", () => {
  assert.equal(estimateMonthlyFromPlans({ STARTER: 2, PRO: 1, COMP: 5, TRIAL: 3, NONE: 1, AGENCY: 0 }), 2 * 29 + 79);
});

test("ttl cache loads once per key within the ttl and again after it", async () => {
  let t = 0;
  let calls = 0;
  const cache = createTtlCache<number>(1000, () => t);
  const load = async () => ++calls;
  assert.equal(await cache.get("2026-11", load), 1);
  t = 999;
  assert.equal(await cache.get("2026-11", load), 1);
  t = 1000;
  assert.equal(await cache.get("2026-11", load), 2);
});

test("ttl cache keeps keys separate", async () => {
  let calls = 0;
  const cache = createTtlCache<number>(1000, () => 0);
  const load = async () => ++calls;
  await cache.get("2026-11", load);
  assert.equal(await cache.get("2026-12", load), 2);
});

test("ttl cache does not cache a rejected load", async () => {
  let calls = 0;
  const cache = createTtlCache<number>(1000, () => 0);
  await assert.rejects(cache.get("k", async () => { calls++; throw new Error("boom"); }));
  assert.equal(await cache.get("k", async () => { calls++; return 7; }), 7);
  assert.equal(calls, 2);
});

test("formatMinor uses the currency's own fraction digits", () => {
  const gbp = formatMinor(2900, "GBP");
  const jpy = formatMinor(2900, "JPY");
  assert.match(gbp, /29\.00/);
  assert.ok(gbp.includes("£"));
  assert.match(jpy, /2,900/);
  assert.ok(!jpy.includes("."));
});

test("formatMinor does not throw on a malformed currency code", () => {
  let out = "";
  assert.doesNotThrow(() => {
    out = formatMinor(1234, "xx");
  });
  assert.ok(out.includes("12.34"));
  assert.ok(out.includes("XX"));
});

test("planFromPrice: lookup key first, then the product id (string or expanded), else null", () => {
  assert.equal(planFromPrice({ lookup_key: "diyseo_pro_monthly", product: "prod_x" }), "pro");
  assert.equal(planFromPrice({ lookup_key: null, product: "diyseo_agency" }), "agency");
  assert.equal(planFromPrice({ lookup_key: undefined, product: { id: "diyseo_starter" } }), "starter");
  assert.equal(planFromPrice({ lookup_key: null, product: "prod_other" }), null);
  assert.equal(planFromPrice({ lookup_key: null, product: null }), null);
  assert.equal(planFromPrice(undefined), null);
});

test("negative cache blocks for the ttl after a failure, then expires; keys are independent", () => {
  let t = 1000;
  const neg = createNegativeCache(30_000, () => t);
  assert.equal(neg.isBlocked("a"), false);
  neg.mark("a");
  assert.equal(neg.isBlocked("a"), true);
  assert.equal(neg.isBlocked("b"), false);
  t += 29_999;
  assert.equal(neg.isBlocked("a"), true);
  t += 1;
  assert.equal(neg.isBlocked("a"), false);
});

test("collectPaged stops at the cap and once the stop flag is set", async () => {
  const source = (n: number) => ({
    async autoPagingEach(cb: (item: number) => boolean | void | Promise<boolean | void>) {
      for (let i = 0; i < n; i++) if ((await cb(i)) === false) return;
    }
  });
  assert.equal((await collectPaged(source(10), { stopped: false }, 4)).length, 4);
  assert.equal((await collectPaged(source(3), { stopped: false }, 4)).length, 3);
  const stop = { stopped: false };
  const seen: number[] = [];
  const stoppable = {
    async autoPagingEach(cb: (item: number) => boolean | void | Promise<boolean | void>) {
      for (let i = 0; i < 10; i++) {
        if (i === 2) stop.stopped = true;
        seen.push(i);
        if ((await cb(i)) === false) return;
      }
    }
  };
  await collectPaged(stoppable, stop, 100);
  assert.deepEqual(seen, [0, 1, 2]);
});
