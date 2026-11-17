// Runs against a real Postgres only when QUOTA_TEST_DATABASE_URL is set (a
// disposable database with all migrations applied); skipped otherwise.
import assert from "node:assert/strict";
import { after, before, test } from "node:test";

const url = process.env.QUOTA_TEST_DATABASE_URL;
const skip = !url;
if (url) process.env.DATABASE_URL = url;

let claimSocialPost: typeof import("../lib/social/claim").claimSocialPost;
let prisma: typeof import("../lib/prisma").prisma;

before(async () => {
  if (skip) return;
  claimSocialPost = (await import("../lib/social/claim")).claimSocialPost;
  prisma = (await import("../lib/prisma")).prisma;
  await prisma.socialPost.deleteMany();
  await prisma.article.deleteMany();
  await prisma.siteProject.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.user.deleteMany();
  await prisma.user.create({ data: { id: "u_soc", email: "soc@test.io" } });
  await prisma.workspace.create({ data: { id: "w_soc", ownerId: "u_soc", plan: "PRO" } });
  await prisma.siteProject.create({ data: { id: "s_soc", workspaceId: "w_soc", name: "Site", domain: "https://x.io" } });
  await prisma.article.create({ data: { id: "a_soc", siteProjectId: "s_soc", title: "T", slug: "t", contentHtml: "<p>x</p>", status: "PUBLISHED" } });
});

after(async () => {
  if (!skip) await prisma.$disconnect();
});

async function post(network: "FACEBOOK" | "INSTAGRAM" | "X", status: "DRAFT" | "PUBLISHED") {
  return prisma.socialPost.create({ data: { articleId: "a_soc", siteProjectId: "s_soc", network, text: "t", status } });
}

test("only one of two concurrent claims wins", { skip }, async () => {
  const p = await post("FACEBOOK", "DRAFT");
  const results = await Promise.all([
    claimSocialPost(prisma, { postId: p.id, siteProjectId: "s_soc", attemptId: "a1" }),
    claimSocialPost(prisma, { postId: p.id, siteProjectId: "s_soc", attemptId: "a2" })
  ]);
  assert.equal(results.filter(Boolean).length, 1);
  const row = await prisma.socialPost.findUniqueOrThrow({ where: { id: p.id } });
  assert.equal(row.status, "PUBLISHING");
  assert.ok(row.attemptId === "a1" || row.attemptId === "a2");
});

test("a PUBLISHED post cannot be claimed", { skip }, async () => {
  const p = await post("INSTAGRAM", "PUBLISHED");
  assert.equal(await claimSocialPost(prisma, { postId: p.id, siteProjectId: "s_soc", attemptId: "a3" }), false);
});

test("a claim with the wrong siteProjectId fails", { skip }, async () => {
  const p = await post("X", "DRAFT");
  assert.equal(await claimSocialPost(prisma, { postId: p.id, siteProjectId: "s_other", attemptId: "a4" }), false);
});

test("a late attempt cannot overwrite a post the user already resolved", { skip }, async () => {
  const { finishAttempt } = await import("../lib/social/claim");
  const p = await prisma.socialPost.create({
    data: { articleId: "a_soc", siteProjectId: "s_soc", network: "LINKEDIN", text: "t", status: "PUBLISHED", attemptId: "late" }
  });
  assert.equal(await finishAttempt(prisma, { postId: p.id, siteProjectId: "s_soc", attemptId: "late" }, { status: "FAILED", error: "4xx" }), false);
  assert.equal((await prisma.socialPost.findUniqueOrThrow({ where: { id: p.id } })).status, "PUBLISHED");
});

test("a claim keeps the previous error, so a blocked release does not lose it", { skip }, async () => {
  const p = await prisma.socialPost.create({
    data: { articleId: "a_soc", siteProjectId: "s_soc", network: "FACEBOOK", text: "t", status: "FAILED", error: "Meta: (#200) Permissions error" }
  }).catch(async () => {
    await prisma.socialPost.deleteMany({ where: { articleId: "a_soc", network: "FACEBOOK" } });
    return prisma.socialPost.create({
      data: { articleId: "a_soc", siteProjectId: "s_soc", network: "FACEBOOK", text: "t", status: "FAILED", error: "Meta: (#200) Permissions error" }
    });
  });
  assert.equal(await claimSocialPost(prisma, { postId: p.id, siteProjectId: "s_soc", attemptId: "keep" }), true);
  assert.equal((await prisma.socialPost.findUniqueOrThrow({ where: { id: p.id } })).error, "Meta: (#200) Permissions error");
});

test("two concurrent connections for one site both succeed and leave one row", { skip }, async () => {
  const { saveConnection } = await import("../lib/social/connection");
  const data = (name: string) => ({ pageId: "123456", pageName: name, instagramAccountId: null, instagramUsername: null, accessTokenEncrypted: "v1:a:b:c", tokenLast4: "abcd", connectedByUserId: "u_soc" });
  await Promise.all([saveConnection(prisma, "s_soc", "w_soc", data("A")), saveConnection(prisma, "s_soc", "w_soc", data("B"))]);
  assert.equal(await prisma.siteSocialConnection.count({ where: { siteProjectId: "s_soc" } }), 1);
});

test("resolving UNKNOWN fails when the attempt was refreshed meanwhile", { skip }, async () => {
  const { resolveUnknown } = await import("../lib/social/claim");
  await prisma.socialPost.deleteMany({ where: { articleId: "a_soc", network: "INSTAGRAM" } });
  const p = await prisma.socialPost.create({
    data: { articleId: "a_soc", siteProjectId: "s_soc", network: "INSTAGRAM", text: "t", status: "PUBLISHING", attemptId: "live" }
  });
  // updatedAt is fresh (the attempt is still running): neither outcome may be written.
  assert.equal(await resolveUnknown(prisma, { postId: p.id, siteProjectId: "s_soc", attemptId: "live" }, "retry", new Date()), false);
  // Six minutes later it may.
  assert.equal(await resolveUnknown(prisma, { postId: p.id, siteProjectId: "s_soc", attemptId: "live" }, "retry", new Date(Date.now() + 6 * 60_000)), true);
  assert.equal((await prisma.socialPost.findUniqueOrThrow({ where: { id: p.id } })).status, "FAILED");
});

test("a connection is saved only while the site still belongs to the caller's workspace", { skip }, async () => {
  const { saveConnection } = await import("../lib/social/connection");
  const data = { pageId: "123456", pageName: "Old owner", instagramAccountId: null, instagramUsername: null, accessTokenEncrypted: "v1:a:b:c", tokenLast4: "abcd", connectedByUserId: "u_soc" };
  await prisma.siteSocialConnection.deleteMany({ where: { siteProjectId: "s_soc" } });
  assert.equal(await saveConnection(prisma, "s_soc", "w_other", data), false);
  assert.equal(await prisma.siteSocialConnection.count({ where: { siteProjectId: "s_soc" } }), 0);
  assert.equal(await saveConnection(prisma, "s_soc", "w_soc", data), true);
});
