import assert from "node:assert/strict";
import test from "node:test";
import { applyPlanChange, type PlanTx } from "../lib/admin-plan-service";

const now = new Date("2026-11-10T12:00:00Z");
const day = 24 * 60 * 60 * 1000;
const actor = { id: "admin1", email: "admin@example.com" };

type WsRow = { plan: string; trialEndsAt: Date | null; subscriptionStatus: string | null };

function fake(ws: WsRow | null) {
  const calls: string[] = [];
  const state = {
    ws,
    audits: [] as Array<Parameters<PlanTx["createAudit"]>[0]>,
    updates: 0,
    calls
  };
  const tx: PlanTx = {
    async lock() {
      calls.push("lock");
    },
    async findWorkspace() {
      calls.push("find");
      return state.ws ? { ...state.ws } : null;
    },
    async updateWorkspace(_id, data) {
      state.updates += 1;
      state.ws = { ...state.ws!, ...data };
    },
    async findAudit(opId) {
      const row = state.audits.find((a) => a.opId === opId);
      calls.push("findAudit");
      return row ? { action: row.action, workspaceId: row.workspaceId, after: row.after } : null;
    },
    async createAudit(row) {
      state.audits.push(row);
    }
  };
  return { tx, state };
}

const input = (action: "GRANT_COMP" | "REVOKE_COMP" | "EXTEND_TRIAL", opId: string, days?: number) => ({
  workspaceId: "w1",
  action,
  opId,
  days,
  actor,
  now
});

test("grant COMP writes workspace and one audit row", async () => {
  const { tx, state } = fake({ plan: "TRIAL", trialEndsAt: new Date(now.getTime() + day), subscriptionStatus: null });
  const r = await applyPlanChange(tx, input("GRANT_COMP", "op1"));
  assert.ok(r.success);
  assert.equal(state.ws!.plan, "COMP");
  assert.equal(state.ws!.trialEndsAt, null);
  assert.equal(state.audits.length, 1);
  const a = state.audits[0];
  assert.equal(a.action, "GRANT_COMP");
  assert.equal(a.actorUserId, "admin1");
  assert.equal(a.actorEmail, "admin@example.com");
  assert.equal(a.workspaceId, "w1");
  assert.deepEqual(a.before, { plan: "TRIAL", trialEndsAt: new Date(now.getTime() + day).toISOString() });
  assert.deepEqual(a.after, { plan: "COMP", trialEndsAt: null });
});

test("revoke COMP writes workspace and audit row", async () => {
  const { tx, state } = fake({ plan: "COMP", trialEndsAt: null, subscriptionStatus: null });
  const r = await applyPlanChange(tx, input("REVOKE_COMP", "op1"));
  assert.ok(r.success);
  assert.equal(state.ws!.plan, "NONE");
  assert.equal(state.audits.length, 1);
  assert.equal(state.audits[0].action, "REVOKE_COMP");
  assert.deepEqual(state.audits[0].before, { plan: "COMP", trialEndsAt: null });
  assert.deepEqual(state.audits[0].after, { plan: "NONE", trialEndsAt: null });
});

test("extend trial records days and moves the date", async () => {
  const { tx, state } = fake({ plan: "TRIAL", trialEndsAt: null, subscriptionStatus: null });
  const r = await applyPlanChange(tx, input("EXTEND_TRIAL", "op1", 7));
  assert.ok(r.success);
  assert.equal(state.ws!.plan, "TRIAL");
  assert.equal(state.ws!.trialEndsAt!.getTime(), now.getTime() + 7 * day);
  assert.equal(state.audits.length, 1);
  assert.equal(state.audits[0].action, "EXTEND_TRIAL");
  assert.deepEqual(state.audits[0].before, { plan: "TRIAL", trialEndsAt: null });
  assert.deepEqual(state.audits[0].after, {
    plan: "TRIAL",
    trialEndsAt: new Date(now.getTime() + 7 * day).toISOString(),
    days: 7
  });
});

test("refusals return the reason and write nothing", async () => {
  const cases: Array<[WsRow, ReturnType<typeof input>]> = [
    [{ plan: "STARTER", trialEndsAt: null, subscriptionStatus: "active" }, input("GRANT_COMP", "a")],
    [{ plan: "COMP", trialEndsAt: null, subscriptionStatus: null }, input("GRANT_COMP", "b")],
    [{ plan: "TRIAL", trialEndsAt: null, subscriptionStatus: null }, input("EXTEND_TRIAL", "c", 3)],
    [{ plan: "COMP", trialEndsAt: null, subscriptionStatus: "active" }, input("REVOKE_COMP", "d")],
    [{ plan: "TRIAL", trialEndsAt: null, subscriptionStatus: null }, input("REVOKE_COMP", "e")]
  ];
  for (const [ws, inp] of cases) {
    const { tx, state } = fake(ws);
    const r = await applyPlanChange(tx, inp);
    assert.ok(r.error, inp.opId);
    assert.equal(r.success, undefined);
    assert.equal(state.audits.length, 0);
    assert.equal(state.updates, 0);
  }
});

test("same opId is idempotent: original message, date moves once", async () => {
  const { tx, state } = fake({ plan: "TRIAL", trialEndsAt: null, subscriptionStatus: null });
  const first = await applyPlanChange(tx, input("EXTEND_TRIAL", "same", 7));
  const second = await applyPlanChange(tx, { ...input("EXTEND_TRIAL", "same", 7), now: new Date(now.getTime() + day) });
  assert.deepEqual(second, first);
  assert.equal(state.updates, 1);
  assert.equal(state.audits.length, 1);
  assert.equal(state.ws!.trialEndsAt!.getTime(), now.getTime() + 7 * day);
});

test("different opId applies a second extension from the new end", async () => {
  const { tx, state } = fake({ plan: "TRIAL", trialEndsAt: null, subscriptionStatus: null });
  await applyPlanChange(tx, input("EXTEND_TRIAL", "one", 7));
  await applyPlanChange(tx, input("EXTEND_TRIAL", "two", 7));
  assert.equal(state.audits.length, 2);
  assert.equal(state.ws!.trialEndsAt!.getTime(), now.getTime() + 14 * day);
});

test("lock is taken before the workspace is read", async () => {
  const { tx, state } = fake({ plan: "TRIAL", trialEndsAt: null, subscriptionStatus: null });
  await applyPlanChange(tx, input("GRANT_COMP", "op"));
  assert.equal(state.calls[0], "lock");
  assert.ok(state.calls.indexOf("lock") < state.calls.indexOf("findAudit"));
  assert.ok(state.calls.indexOf("lock") < state.calls.indexOf("find"));
});

test("unknown workspace returns an error", async () => {
  const { tx, state } = fake(null);
  const r = await applyPlanChange(tx, input("GRANT_COMP", "op"));
  assert.equal(r.error, "Workspace not found.");
  assert.equal(state.audits.length, 0);
});

test("opId reused for a different workspace or action is refused and changes nothing", async () => {
  const { tx, state } = fake({ plan: "TRIAL", trialEndsAt: null, subscriptionStatus: null });
  await applyPlanChange(tx, input("GRANT_COMP", "shared"));
  const wsBefore = { ...state.ws! };

  const otherWs = await applyPlanChange(tx, { ...input("GRANT_COMP", "shared"), workspaceId: "w2" });
  assert.equal(otherWs.error, "Invalid request.");
  assert.equal(otherWs.success, undefined);

  const otherAction = await applyPlanChange(tx, input("REVOKE_COMP", "shared"));
  assert.equal(otherAction.error, "Invalid request.");
  assert.equal(otherAction.success, undefined);

  assert.equal(state.audits.length, 1);
  assert.equal(state.updates, 1);
  assert.deepEqual(state.ws, wsBefore);
});

test("extending an already expired trial starts from now", async () => {
  const { tx, state } = fake({ plan: "TRIAL", trialEndsAt: new Date(now.getTime() - 3 * day), subscriptionStatus: null });
  const r = await applyPlanChange(tx, input("EXTEND_TRIAL", "exp", 14));
  assert.ok(r.success);
  assert.equal(state.ws!.plan, "TRIAL");
  assert.equal(state.ws!.trialEndsAt!.getTime(), now.getTime() + 14 * day);
});
