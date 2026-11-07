// Runs against a real Postgres only when QUOTA_TEST_DATABASE_URL is set (a
// disposable database with all migrations applied); skipped otherwise.
import assert from "node:assert/strict";
import { after, before, test } from "node:test";

const url = process.env.QUOTA_TEST_DATABASE_URL;
const skip = !url;
if (url) process.env.DATABASE_URL = url;

let q: typeof import("../lib/quota");
let prisma: typeof import("../lib/prisma").prisma;

before(async () => {
  if (skip) return;
  q = await import("../lib/quota");
  prisma = (await import("../lib/prisma")).prisma;
  await prisma.aiUsage.deleteMany();
  await prisma.siteProject.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.user.deleteMany();
});

after(async () => {
  if (!skip) await prisma.$disconnect();
});

async function workspace(id: string, plan: string, trialEndsAt: Date | null = null) {
  await prisma.user.create({ data: { id: `u_${id}`, email: `${id}@test.io` } });
  await prisma.workspace.create({ data: { id, ownerId: `u_${id}`, plan, trialEndsAt } });
  await prisma.siteProject.create({ data: { id: `s_${id}`, workspaceId: id, name: "Site", domain: "https://x.io" } });
}

async function fill(workspaceId: string, count: number) {
  await prisma.aiUsage.createMany({
    data: Array.from({ length: count }, () => ({ workspaceId, siteProjectId: `s_${workspaceId}`, kind: "ARTICLE", status: "COMMITTED" }))
  });
}

test("a trial at 40 credits refuses the 41st", { skip }, async () => {
  await workspace("w_trial", "TRIAL", new Date(Date.now() + 86_400_000));
  await fill("w_trial", 40);
  await assert.rejects(q.reserveArticleCredit({ workspaceId: "w_trial", siteProjectId: "s_w_trial", kind: "ARTICLE" }), q.QuotaError);
});

test("parallel reservations for the last credit give exactly one success", { skip }, async () => {
  await workspace("w_race", "PRO");
  await fill("w_race", 39);
  const results = await Promise.allSettled(
    Array.from({ length: 5 }, () => q.reserveArticleCredit({ workspaceId: "w_race", siteProjectId: "s_w_race", kind: "ARTICLE" }))
  );
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
});

test("a released reservation gives the credit back", { skip }, async () => {
  await workspace("w_release", "STARTER");
  await fill("w_release", 11);
  const id = await q.reserveArticleCredit({ workspaceId: "w_release", siteProjectId: "s_w_release", kind: "ARTICLE" });
  await q.releaseArticleCredit(id);
  await q.reserveArticleCredit({ workspaceId: "w_release", siteProjectId: "s_w_release", kind: "ARTICLE" });
});

test("starter cannot translate, comp is never refused", { skip }, async () => {
  await workspace("w_comp", "COMP");
  await fill("w_comp", 500);
  await q.reserveArticleCredit({ workspaceId: "w_comp", siteProjectId: "s_w_comp", kind: "TRANSLATION" });
  await assert.rejects(
    q.reserveArticleCredit({ workspaceId: "w_release", siteProjectId: "s_w_release", kind: "TRANSLATION" }),
    /Pro and Agency/
  );
});

test("parallel site creation stops at the plan limit", { skip }, async () => {
  await workspace("w_sites", "PRO"); // already has 1 site, limit 3
  const results = await Promise.allSettled(
    Array.from({ length: 4 }, (_, i) =>
      q.withSiteSlot("w_sites", (tx) => tx.siteProject.create({ data: { workspaceId: "w_sites", name: `S${i}`, domain: "https://x.io" } }))
    )
  );
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 2);
  assert.equal(await prisma.siteProject.count({ where: { workspaceId: "w_sites" } }), 3);
});

test("an expired trial cannot add sites", { skip }, async () => {
  await workspace("w_expired", "TRIAL", new Date(Date.now() - 1000));
  await assert.rejects(q.withSiteSlot("w_expired", async () => null), /trial has ended/);
});

test("committing an expired reservation re-checks the quota", { skip }, async () => {
  await workspace("w_late", "STARTER");
  await fill("w_late", 11);
  const old = await prisma.aiUsage.create({
    data: { workspaceId: "w_late", siteProjectId: "s_w_late", kind: "ARTICLE", createdAt: new Date(Date.now() - 20 * 60 * 1000) }
  });
  // The expired reservation no longer counts, so this one takes the 12th credit.
  await q.reserveArticleCredit({ workspaceId: "w_late", siteProjectId: "s_w_late", kind: "ARTICLE" });
  await assert.rejects(prisma.$transaction((tx) => q.commitArticleCredit(tx, old.id)), q.QuotaError);
});

test("committing a fresh reservation succeeds", { skip }, async () => {
  const id = await q.reserveArticleCredit({ workspaceId: "w_comp", siteProjectId: "s_w_comp", kind: "ARTICLE" });
  await prisma.$transaction((tx) => q.commitArticleCredit(tx, id));
  assert.equal((await prisma.aiUsage.findUniqueOrThrow({ where: { id } })).status, "COMMITTED");
});
