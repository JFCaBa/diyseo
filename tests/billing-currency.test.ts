import assert from "node:assert/strict";
import { test } from "node:test";

import { canReusePending, checkoutCurrency, checkoutIdempotencyKey } from "../lib/billing-currency";
import { formatPlanPrice } from "../lib/i18n/translate";

test("a new customer pays in euros from the Spanish UI and in pounds from the English one", () => {
  assert.equal(checkoutCurrency({ customerCurrency: null, locale: "es" }), "eur");
  assert.equal(checkoutCurrency({ customerCurrency: null, locale: "en" }), "gbp");
});

test("a customer who already paid in one currency keeps it, whatever the UI language", () => {
  assert.equal(checkoutCurrency({ customerCurrency: "gbp", locale: "es" }), "gbp");
  assert.equal(checkoutCurrency({ customerCurrency: "eur", locale: "en" }), "eur");
});

test("an unsupported customer currency falls back to the locale rule", () => {
  assert.equal(checkoutCurrency({ customerCurrency: "usd", locale: "es" }), "eur");
});

test("an open session is reused only for the same price and the same currency", () => {
  const pending = { status: "open", url: "https://checkout", currency: "gbp", metadata: { priceId: "price_1" } };
  assert.equal(canReusePending(pending, "price_1", "gbp"), true);
  assert.equal(canReusePending(pending, "price_1", "eur"), false);
  assert.equal(canReusePending(pending, "price_2", "gbp"), false);
  assert.equal(canReusePending({ ...pending, status: "expired" }, "price_1", "gbp"), false);
  assert.equal(canReusePending({ ...pending, url: null }, "price_1", "gbp"), false);
  assert.equal(canReusePending(null, "price_1", "gbp"), false);
});

test("the idempotency key changes with the currency and with the session it replaces", () => {
  assert.equal(checkoutIdempotencyKey("ws1", "price_1", "gbp", 7, null), "checkout:ws1:price_1:gbp:7:none");
  assert.notEqual(checkoutIdempotencyKey("ws1", "price_1", "eur", 7, null), checkoutIdempotencyKey("ws1", "price_1", "gbp", 7, null));
});

test("GBP → EUR → GBP in the same half hour never hands back the first, already expired session", () => {
  // Each step replaces the pending session of the previous one, as startCheckout does.
  const first = checkoutIdempotencyKey("ws1", "price_1", "gbp", 7, null);
  const second = checkoutIdempotencyKey("ws1", "price_1", "eur", 7, "cs_first");
  const third = checkoutIdempotencyKey("ws1", "price_1", "gbp", 7, "cs_second");
  assert.equal(new Set([first, second, third]).size, 3);
  // A retry of the same step (same pending session) keeps its key, so Stripe returns the session it already made.
  assert.equal(checkoutIdempotencyKey("ws1", "price_1", "gbp", 7, "cs_second"), third);
});

test("plan prices: £29 in English, 29 € in Spanish, and the currency is never taken from the language", () => {
  assert.equal(formatPlanPrice(29, "gbp", "en"), "£29");
  assert.equal(formatPlanPrice(29, "eur", "es").replace(/\s/g, " "), "29 €");
  assert.equal(formatPlanPrice(29, "gbp", "es").replace(/\s/g, " "), "29 £");
  assert.equal(formatPlanPrice(29, "eur", "en"), "€29");
});
