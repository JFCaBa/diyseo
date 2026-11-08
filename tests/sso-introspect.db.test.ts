// Runs against a real Postgres only when QUOTA_TEST_DATABASE_URL is set; skipped otherwise.
import assert from "node:assert/strict";
import { after, before, test } from "node:test";

const url = process.env.QUOTA_TEST_DATABASE_URL;
const skip = !url;
if (url) process.env.DATABASE_URL = url;

let introspect: typeof import("../lib/sso/introspect");
let teams: typeof import("../lib/teams");
let grants: typeof import("../lib/satellite-entitlements");
let prisma: typeof import("../lib/prisma").prisma;

const NOW = new Date("2026-06-01T00:00:00Z");

before(async () => {
  if (skip) return;
  introspect = await import("../lib/sso/introspect");
  teams = await import("../lib/teams");
  grants = await import("../lib/satellite-entitlements");
  prisma = (await import("../lib/prisma")).prisma;
  await prisma.workspaceInvite.deleteMany();
  await prisma.workspaceMember.deleteMany();
  await prisma.aiUsage.deleteMany();
  await prisma.article.deleteMany();
  await prisma.keyword.deleteMany();
  await prisma.siteProject.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.user.deleteMany();
  await prisma.user.createMany({
    data: [
      { id: "u_a", email: "a@test.io" },
      { id: "u_m", email: "m@test.io" },
      { id: "u_t", email: "t@test.io" },
    ],
  });
  await prisma.workspace.create({ data: { id: "w_a", ownerId: "u_a", plan: "PRO" } });
  await prisma.workspaceMember.create({ data: { workspaceId: "w_a", userId: "u_a", role: "OWNER" } });
  await prisma.workspaceMember.create({ data: { workspaceId: "w_a", userId: "u_m", role: "MEMBER" } });
  await prisma.workspace.create({
    data: { id: "w_t", ownerId: "u_t", plan: "TRIAL", trialEndsAt: new Date("2026-05-01T00:00:00Z") },
  });
  await prisma.workspaceMember.create({ data: { workspaceId: "w_t", userId: "u_t", role: "OWNER" } });
});

after(async () => {
  if (!skip) await prisma.$disconnect();
});

test("an active member gets workspace, member id, role, plan and grant", { skip }, async () => {
  const row = await prisma.workspaceMember.findUniqueOrThrow({ where: { userId: "u_m" } });
  assert.deepEqual(await introspect.introspectUser("u_m", NOW), {
    active: true,
    wid: "w_a",
    mid: row.id,
    role: "MEMBER",
    plan: "PRO",
    grant: grants.satelliteGrant("PRO"),
  });
});

test("an unknown sub is inactive", { skip }, async () => {
  assert.deepEqual(await introspect.introspectUser("nobody", NOW), { active: false });
});

test("a removed member is inactive, and re-joining yields a new member id", { skip }, async () => {
  const before = await introspect.introspectUser("u_m", NOW);
  assert.ok(before.active);
  await teams.removeMember("w_a", "u_m");
  assert.deepEqual(await introspect.introspectUser("u_m", NOW), { active: false });

  const invite = await teams.createInvite("w_a", "u_a", "m@test.io", NOW);
  assert.ok("token" in invite);
  const accepted = await teams.acceptInvite(invite.token, { id: "u_m", email: "m@test.io" }, NOW);
  assert.deepEqual(accepted, { workspaceId: "w_a" });

  const after = await introspect.introspectUser("u_m", NOW);
  assert.ok(after.active && before.active);
  assert.notEqual(after.mid, before.mid);
});

test("a workspace reports its plan and grant; an unknown one is inactive", { skip }, async () => {
  assert.deepEqual(await introspect.introspectWorkspace("w_a", NOW), {
    active: true,
    plan: "PRO",
    grant: grants.satelliteGrant("PRO"),
  });
  assert.deepEqual(await introspect.introspectWorkspace("w_gone", NOW), { active: false });
});

test("an expired trial is still active but on plan NONE", { skip }, async () => {
  const expected = { active: true, plan: "NONE", grant: grants.satelliteGrant("NONE") };
  assert.deepEqual(await introspect.introspectWorkspace("w_t", NOW), expected);
  const user = await introspect.introspectUser("u_t", NOW);
  assert.ok(user.active);
  assert.equal(user.active && user.plan, "NONE");
});
