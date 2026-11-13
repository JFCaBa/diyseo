import assert from "node:assert/strict";
import { test } from "node:test";

import { canChangeRole } from "../lib/team-roles";

const base = { primaryOwnerId: "p", targetUserId: "m", targetRole: "MEMBER" as const, nextRole: "OWNER" as const };

test("the main owner appoints and revokes co-owners", () => {
  assert.deepEqual(canChangeRole({ ...base, actorUserId: "p" }), { ok: true });
  assert.deepEqual(canChangeRole({ ...base, actorUserId: "p", targetRole: "OWNER", nextRole: "MEMBER" }), { ok: true });
});

test("a co-owner cannot appoint or revoke other owners", () => {
  assert.deepEqual(canChangeRole({ ...base, actorUserId: "c" }), { ok: false, error: "primary_only" });
  assert.deepEqual(
    canChangeRole({ ...base, actorUserId: "c", targetRole: "OWNER", nextRole: "MEMBER" }),
    { ok: false, error: "primary_only" }
  );
});

test("a co-owner can step down, but never promote themselves", () => {
  assert.deepEqual(
    canChangeRole({ ...base, actorUserId: "m", targetRole: "OWNER", nextRole: "MEMBER" }),
    { ok: true }
  );
  assert.deepEqual(canChangeRole({ ...base, actorUserId: "m" }), { ok: false, error: "primary_only" });
});

test("the main owner's role never changes, not even by themselves", () => {
  for (const actorUserId of ["p", "c"]) {
    assert.deepEqual(
      canChangeRole({ ...base, actorUserId, targetUserId: "p", targetRole: "OWNER", nextRole: "MEMBER" }),
      { ok: false, error: "primary_owner" }
    );
  }
});

test("setting the role someone already has is refused", () => {
  assert.deepEqual(canChangeRole({ ...base, actorUserId: "p", nextRole: "MEMBER" }), { ok: false, error: "unchanged" });
});
