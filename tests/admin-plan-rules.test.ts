import assert from "node:assert/strict";
import test from "node:test";
import { decideExtendTrial, decideGrantComp, decideRevokeComp, EXTEND_PRESETS } from "../lib/admin-plan-rules";

const now = new Date("2026-11-10T12:00:00Z");
const future = new Date("2026-11-15T12:00:00Z");
const past = new Date("2026-11-01T12:00:00Z");
const day = 24 * 60 * 60 * 1000;
const ws = (plan: string, trialEndsAt: Date | null = null, subscriptionStatus: string | null = null, ownerListed = false) => ({ plan, trialEndsAt, subscriptionStatus, ownerListed });

test("presets", () => assert.deepEqual([...EXTEND_PRESETS], [7, 14]));

test("grant COMP on non-COMP without live subscription", () => {
  for (const plan of ["TRIAL", "NONE", "STARTER"]) {
    assert.deepEqual(decideGrantComp(ws(plan, future)), { ok: true, plan: "COMP", trialEndsAt: null });
  }
  for (const s of ["canceled", null]) assert.equal(decideGrantComp(ws("STARTER", null, s)).ok, true);
});

test("grant COMP refused when already COMP", () => {
  const d = decideGrantComp(ws("COMP"));
  assert.equal(d.ok, false);
  if (!d.ok) assert.match(d.reason, /already COMP/);
});

test("grant COMP refused with live subscription", () => {
  for (const s of ["active", "trialing", "past_due"]) {
    const d = decideGrantComp(ws("STARTER", null, s));
    assert.equal(d.ok, false);
    if (!d.ok) assert.match(d.reason, /Stripe/);
  }
});

test("revoke refused when not COMP", () => assert.equal(decideRevokeComp(ws("TRIAL"), now).ok, false));

test("revoke refused with live subscription", () => {
  for (const s of ["active", "trialing", "past_due"]) {
    const d = decideRevokeComp(ws("COMP", null, s), now);
    assert.equal(d.ok, false);
    if (!d.ok) assert.match(d.reason, /Stripe/);
  }
  for (const s of ["canceled", null]) assert.equal(decideRevokeComp(ws("COMP", null, s), now).ok, true);
});

test("revoke gives TRIAL with future end, NONE otherwise", () => {
  assert.deepEqual(decideRevokeComp(ws("COMP", future), now), { ok: true, plan: "TRIAL", trialEndsAt: future });
  assert.deepEqual(decideRevokeComp(ws("COMP", past), now), { ok: true, plan: "NONE", trialEndsAt: past });
  assert.deepEqual(decideRevokeComp(ws("COMP", null), now), { ok: true, plan: "NONE", trialEndsAt: null });
});

test("extend adds days to future end or to now", () => {
  assert.deepEqual(decideExtendTrial(ws("TRIAL", future), 7, now), { ok: true, plan: "TRIAL", trialEndsAt: new Date(future.getTime() + 7 * day) });
  assert.deepEqual(decideExtendTrial(ws("NONE", past), 14, now), { ok: true, plan: "TRIAL", trialEndsAt: new Date(now.getTime() + 14 * day) });
  assert.deepEqual(decideExtendTrial(ws("NONE", null), 7, now), { ok: true, plan: "TRIAL", trialEndsAt: new Date(now.getTime() + 7 * day) });
});

test("extend refusals", () => {
  assert.equal(decideExtendTrial(ws("COMP"), 7, now).ok, false);
  assert.equal(decideExtendTrial(ws("TRIAL", future, "active"), 7, now).ok, false);
  for (const d of [0, -7, 30, 7.5, NaN]) assert.equal(decideExtendTrial(ws("TRIAL", future), d, now).ok, false);
});

const LISTED = /ALLOWED_EMAILS/;

test("revoke and extend refused when the owner is listed in ALLOWED_EMAILS", () => {
  const r = decideRevokeComp(ws("COMP", future, null, true), now);
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.reason, LISTED);
  const e = decideExtendTrial(ws("TRIAL", future, null, true), 7, now);
  assert.equal(e.ok, false);
  if (!e.ok) assert.match(e.reason, LISTED);
});

test("revoke and extend allowed when the owner is not listed", () => {
  assert.equal(decideRevokeComp(ws("COMP", future, null, false), now).ok, true);
  assert.equal(decideExtendTrial(ws("TRIAL", future, null, false), 7, now).ok, true);
});

test("grant COMP is unaffected by ownerListed", () => {
  assert.equal(decideGrantComp(ws("TRIAL", future, null, true)).ok, true);
});
