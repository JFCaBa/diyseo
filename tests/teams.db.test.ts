// Runs against a real Postgres only when QUOTA_TEST_DATABASE_URL is set; skipped otherwise.
import assert from "node:assert/strict";
import { after, before, test } from "node:test";

const url = process.env.QUOTA_TEST_DATABASE_URL;
const skip = !url;
if (url) process.env.DATABASE_URL = url;

let m: typeof import("../lib/workspace-membership");
let guards: typeof import("../lib/workspace-guards");
let ops: typeof import("../lib/workspace-operations");
let provisioning: typeof import("../lib/workspace-provisioning");
let prisma: typeof import("../lib/prisma").prisma;

before(async () => {
  if (skip) return;
  m = await import("../lib/workspace-membership");
  guards = await import("../lib/workspace-guards");
  ops = await import("../lib/workspace-operations");
  provisioning = await import("../lib/workspace-provisioning");
  prisma = (await import("../lib/prisma")).prisma;
  await prisma.workspaceInvite.deleteMany();
  await prisma.workspaceMember.deleteMany();
  await prisma.aiUsage.deleteMany();
  await prisma.article.deleteMany();
  await prisma.keyword.deleteMany();
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

async function seedTwoWorkspaces() {
  // w_a: OWNER u_a (from the first test) plus MEMBER u_m. w_b: OWNER u_b.
  await prisma.user.create({ data: { id: "u_m", email: "m@test.io" } });
  await prisma.workspaceMember.create({ data: { workspaceId: "w_a", userId: "u_m", role: "MEMBER" } });
  await prisma.workspaceMember.create({ data: { workspaceId: "w_b", userId: "u_b", role: "OWNER" } });
  for (const k of ["a", "b"]) {
    await prisma.siteProject.create({ data: { id: `s_${k}`, workspaceId: `w_${k}`, name: `Site ${k}`, domain: `https://${k}.test` } });
    await prisma.keyword.create({ data: { id: `kw_${k}`, siteProjectId: `s_${k}`, term: `term ${k}` } });
    await prisma.article.create({
      data: { id: `art_${k}`, siteProjectId: `s_${k}`, title: `Title ${k}`, slug: `title-${k}`, contentHtml: "<p>x</p>", contentMarkdown: "x" }
    });
  }
}

test("a member sees the workspace's sites and not another workspace's", { skip }, async () => {
  await seedTwoWorkspaces();
  const member = await m.getMembership("u_m");
  assert.equal(member?.workspaceId, "w_a");
  assert.equal(member?.role, "MEMBER");

  assert.notEqual(await guards.findSiteInWorkspace("s_a", member!.workspaceId), null);
  assert.deepEqual(await guards.findArticleInWorkspace("art_a", "w_a"), { id: "art_a", siteProjectId: "s_a" });
  assert.deepEqual(await guards.findKeywordInWorkspace("kw_a", "w_a"), { id: "kw_a", siteProjectId: "s_a" });

  assert.equal(await guards.findSiteInWorkspace("s_b", "w_a"), null);
  assert.equal(await guards.findArticleInWorkspace("art_b", "w_a"), null);
  assert.equal(await guards.findKeywordInWorkspace("kw_b", "w_a"), null);
});

test("cross-workspace writes are refused and change nothing", { skip }, async () => {
  const snapshot = async () => ({
    site: await prisma.siteProject.findUnique({ where: { id: "s_b" } }),
    article: await prisma.article.findUnique({ where: { id: "art_b" } })
  });
  const before = await snapshot();
  const notFound = (e: Error) => e.message === "Not found";

  await assert.rejects(
    ops.updateArticleInWorkspace("w_a", "s_b", "art_b", {
      title: "Hijacked",
      excerpt: null,
      coverImageUrl: null,
      contentMarkdown: "hijacked",
      seoTitle: null,
      seoDescription: null
    }),
    notFound
  );
  // Right workspace's site in the URL, other workspace's article: still refused.
  await assert.rejects(ops.deleteArticleInWorkspace("w_a", "s_a", "art_b"), notFound);
  await assert.rejects(ops.deleteArticleInWorkspace("w_a", "s_b", "art_b"), notFound);
  await assert.rejects(
    ops.updateAutoPublishSettingsInWorkspace("w_a", "s_b", { autoPublishEnabled: true, articlesPerWeek: 7, requireReview: false }),
    notFound
  );

  assert.deepEqual(await snapshot(), before);

  // The member can write its own workspace's data.
  await ops.updateAutoPublishSettingsInWorkspace("w_a", "s_a", { autoPublishEnabled: true, articlesPerWeek: 3, requireReview: false });
  assert.equal((await prisma.siteProject.findUniqueOrThrow({ where: { id: "s_a" } })).articlesPerWeek, 3);
});

test("only the owner transfers a site, and never inside its own workspace", { skip }, async () => {
  const siteWorkspace = async () => (await prisma.siteProject.findUniqueOrThrow({ where: { id: "s_a" } })).workspaceId;

  // A MEMBER is refused even with the right workspace and site.
  assert.deepEqual(await ops.transferSiteInWorkspace("u_m", "w_a", "s_a", "b@test.io"), { error: ops.TRANSFER_OWNER_ONLY });
  // A caller whose membership is elsewhere cannot act for w_a.
  assert.deepEqual(await ops.transferSiteInWorkspace("u_b", "w_a", "s_a", "b@test.io"), { error: ops.TRANSFER_OWNER_ONLY });
  // The owner cannot transfer to a member of the same workspace, nor to itself.
  assert.deepEqual(await ops.transferSiteInWorkspace("u_a", "w_a", "s_a", "m@test.io"), { error: ops.TRANSFER_SAME_WORKSPACE });
  assert.deepEqual(await ops.transferSiteInWorkspace("u_a", "w_a", "s_a", "a@test.io"), { error: ops.TRANSFER_SAME_WORKSPACE });
  // Nor transfer another workspace's site.
  await assert.rejects(ops.transferSiteInWorkspace("u_a", "w_a", "s_b", "b@test.io"), (e: Error) => e.message === "Not found");
  assert.equal(await siteWorkspace(), "w_a");

  // To another workspace's owner, with a free slot, it moves.
  await prisma.workspace.update({ where: { id: "w_b" }, data: { plan: "COMP" } });
  assert.deepEqual(await ops.transferSiteInWorkspace("u_a", "w_a", "s_a", "b@test.io"), { siteName: "Site a" });
  assert.equal(await siteWorkspace(), "w_b");
});

test("ensureUserWorkspace creates the owner membership", { skip }, async () => {
  await prisma.user.create({ data: { id: "u_new", email: "new@test.io", name: "New" } });
  await provisioning.ensureUserWorkspace("u_new", "New", "new@test.io");

  const membership = await m.getMembership("u_new");
  assert.equal(membership?.role, "OWNER");
  const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: membership!.workspaceId }, include: { sites: true } });
  assert.equal(workspace.sites.length, 1);

  // Idempotent: a second call reuses the same workspace.
  await provisioning.ensureUserWorkspace("u_new", "New", "new@test.io");
  assert.equal((await m.getMembership("u_new"))?.workspaceId, workspace.id);
  assert.equal(await prisma.workspaceMember.count({ where: { userId: "u_new" } }), 1);
});
