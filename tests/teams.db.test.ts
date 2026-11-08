// Runs against a real Postgres only when QUOTA_TEST_DATABASE_URL is set; skipped otherwise.
import assert from "node:assert/strict";
import { after, before, test } from "node:test";

const url = process.env.QUOTA_TEST_DATABASE_URL;
const skip = !url;
if (url) process.env.DATABASE_URL = url;

let m: typeof import("../lib/workspace-membership");
let prisma: typeof import("../lib/prisma").prisma;

before(async () => {
  if (skip) return;
  m = await import("../lib/workspace-membership");
  prisma = (await import("../lib/prisma")).prisma;
  await prisma.workspaceInvite.deleteMany();
  await prisma.workspaceMember.deleteMany();
  await prisma.aiUsage.deleteMany();
  await prisma.siteProject.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.user.deleteMany();
});

after(async () => {
  if (!skip) await prisma.$disconnect();
});

test("backfilled owner is a member with role OWNER", { skip }, async () => {
  await prisma.user.create({ data: { id: "u_a", email: "a@test.io" } });
  await prisma.workspace.create({ data: { id: "w_a", ownerId: "u_a" } });
  await prisma.workspaceMember.create({ data: { id: "wm_w_a", workspaceId: "w_a", userId: "u_a", role: "OWNER" } });
  assert.deepEqual(await m.getMembership("u_a"), { id: "wm_w_a", workspaceId: "w_a", role: "OWNER" });
  assert.equal(await m.getMembership("nobody"), null);
});

test("a user cannot belong to two workspaces", { skip }, async () => {
  await prisma.user.create({ data: { id: "u_b", email: "b@test.io" } });
  await prisma.workspace.create({ data: { id: "w_b", ownerId: "u_b" } });
  await assert.rejects(
    prisma.workspaceMember.create({ data: { workspaceId: "w_b", userId: "u_a", role: "MEMBER" } }),
    (e: { code?: string }) => e.code === "P2002"
  );
});
