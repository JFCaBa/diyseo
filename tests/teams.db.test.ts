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
let teams: typeof import("../lib/teams");
let prisma: typeof import("../lib/prisma").prisma;

before(async () => {
  if (skip) return;
  m = await import("../lib/workspace-membership");
  guards = await import("../lib/workspace-guards");
  ops = await import("../lib/workspace-operations");
  provisioning = await import("../lib/workspace-provisioning");
  teams = await import("../lib/teams");
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

// ---- Team invites. Each test builds its own workspaces (ids w_<k>, owner u_<k>, site s_<k>).

const DAY_MS = 24 * 60 * 60 * 1000;
const T0 = new Date("2026-03-02T10:00:00Z");

/** A workspace with its OWNER member and the default site, like signup creates. */
async function soloWorkspace(k: string, plan = "PRO") {
  await prisma.user.create({ data: { id: `u_${k}`, email: `${k}@test.io` } });
  await prisma.workspace.create({
    data: {
      id: `w_${k}`,
      ownerId: `u_${k}`,
      plan,
      members: { create: { userId: `u_${k}`, role: "OWNER" } },
      sites: {
        create: { id: `s_${k}`, name: "My Site", domain: "https://example.com", brandProfile: { create: { contentLanguage: "en" } } }
      }
    }
  });
}

async function addMember(workspaceId: string, k: string) {
  await prisma.user.create({ data: { id: `u_${k}`, email: `${k}@test.io` } });
  await prisma.workspaceMember.create({ data: { workspaceId, userId: `u_${k}`, role: "MEMBER" } });
}

async function invite(workspaceId: string, email: string, now = T0): Promise<string> {
  const ownerId = (await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } })).ownerId;
  const result = await teams.createInvite(workspaceId, ownerId, email, now);
  assert.ok("token" in result, `expected a token, got ${JSON.stringify(result)}`);
  return result.token;
}

const user = (k: string) => ({ id: `u_${k}`, email: `${k}@test.io` });

test("accepting moves the user and deletes their empty workspace", { skip }, async () => {
  await soloWorkspace("t1");
  await soloWorkspace("x1", "TRIAL");
  const token = await invite("w_t1", "X1@Test.io");

  assert.deepEqual(await teams.acceptInvite(token, { id: "u_x1", email: "x1@TEST.io" }, T0), { workspaceId: "w_t1" });

  assert.deepEqual(await m.getMembership("u_x1"), {
    id: (await prisma.workspaceMember.findUniqueOrThrow({ where: { userId: "u_x1" } })).id,
    workspaceId: "w_t1",
    role: "MEMBER"
  });
  assert.equal(await prisma.workspace.findUnique({ where: { id: "w_x1" } }), null);
  assert.equal(await prisma.siteProject.findUnique({ where: { id: "s_x1" } }), null);
  assert.equal(await prisma.brandProfile.count({ where: { siteProjectId: "s_x1" } }), 0);
  const row = await prisma.workspaceInvite.findFirstOrThrow({ where: { workspaceId: "w_t1", email: "x1@test.io" } });
  assert.ok(row.acceptedAt);
  // The target workspace keeps its owner and site.
  assert.equal((await m.getMembership("u_t1"))?.role, "OWNER");
  assert.notEqual(await prisma.siteProject.findUnique({ where: { id: "s_t1" } }), null);

  // The token is single use.
  assert.deepEqual(await teams.acceptInvite(token, user("x1"), T0), { error: "invalid" });
  assert.deepEqual(await teams.acceptInvite("not-a-token", user("x1"), T0), { error: "invalid" });
});

test("accepting is refused when the email does not match", { skip }, async () => {
  await soloWorkspace("t2");
  await soloWorkspace("x2");
  const token = await invite("w_t2", "someone-else@test.io");

  assert.deepEqual(await teams.acceptInvite(token, user("x2"), T0), { error: "email_mismatch" });
  assert.equal((await m.getMembership("u_x2"))?.workspaceId, "w_x2");
  assert.notEqual(await prisma.workspace.findUnique({ where: { id: "w_x2" } }), null);
});

test("accepting is refused when the user's workspace has articles", { skip }, async () => {
  await soloWorkspace("t3");
  await soloWorkspace("x3");
  await prisma.article.create({
    data: { siteProjectId: "s_x3", title: "Mine", slug: "mine", contentHtml: "<p>x</p>", contentMarkdown: "x" }
  });
  const token = await invite("w_t3", "x3@test.io");

  assert.deepEqual(await teams.acceptInvite(token, user("x3"), T0), { error: "has_content" });
  assert.notEqual(await prisma.workspace.findUnique({ where: { id: "w_x3" } }), null);
  assert.equal((await m.getMembership("u_x3"))?.workspaceId, "w_x3");
  assert.equal((await prisma.workspaceInvite.findFirstOrThrow({ where: { workspaceId: "w_t3" } })).acceptedAt, null);
});

test("an expired invite is refused", { skip }, async () => {
  await soloWorkspace("t4");
  await soloWorkspace("x4");
  const token = await invite("w_t4", "x4@test.io", T0);

  assert.deepEqual(await teams.acceptInvite(token, user("x4"), new Date(T0.getTime() + 7 * DAY_MS + 1)), { error: "expired" });
  assert.equal((await m.getMembership("u_x4"))?.workspaceId, "w_x4");
});

test("pending invites count toward the member limit", { skip }, async () => {
  await soloWorkspace("t5", "PRO");
  await addMember("w_t5", "m5");
  await invite("w_t5", "p5@test.io");

  assert.deepEqual(await teams.createInvite("w_t5", "u_t5", "q5@test.io", T0), { error: "limit_reached" });
  // An expired invite frees its seat.
  const later = new Date(T0.getTime() + 8 * DAY_MS);
  assert.ok("token" in (await teams.createInvite("w_t5", "u_t5", "q5@test.io", later)));
});

test("accepting re-checks the limit of the plan in force", { skip }, async () => {
  await soloWorkspace("t6", "PRO");
  await soloWorkspace("x6");
  const token = await invite("w_t6", "x6@test.io");
  await prisma.workspace.update({ where: { id: "w_t6" }, data: { plan: "STARTER" } });

  assert.deepEqual(await teams.acceptInvite(token, user("x6"), T0), { error: "limit_reached" });
  assert.equal(await prisma.workspaceMember.count({ where: { workspaceId: "w_t6" } }), 1);
  assert.notEqual(await prisma.workspace.findUnique({ where: { id: "w_x6" } }), null);
});

test("two concurrent invites cannot both take the last seat", { skip }, async () => {
  await soloWorkspace("t7", "PRO");
  await addMember("w_t7", "m7");

  const results = await Promise.all([
    teams.createInvite("w_t7", "u_t7", "c1@test.io", T0),
    teams.createInvite("w_t7", "u_t7", "c2@test.io", T0)
  ]);

  assert.equal(results.filter((r) => "token" in r).length, 1, JSON.stringify(results));
  assert.equal(results.filter((r) => "error" in r && r.error === "limit_reached").length, 1);
  assert.equal(await prisma.workspaceInvite.count({ where: { workspaceId: "w_t7" } }), 1);
});

test("three concurrent invites for two free seats: two succeed, one is refused, none throw", { skip }, async () => {
  await soloWorkspace("t16", "PRO");

  const results = await Promise.all(
    ["d1", "d2", "d3"].map((k) => teams.createInvite("w_t16", "u_t16", `${k}@test.io`, T0))
  );

  assert.equal(results.filter((r) => "token" in r).length, 2, JSON.stringify(results));
  assert.equal(results.filter((r) => "error" in r && r.error === "limit_reached").length, 1);
  assert.equal(await prisma.workspaceInvite.count({ where: { workspaceId: "w_t16" } }), 2);
});

test("accepting is refused while the user's workspace has an active subscription", { skip }, async () => {
  await soloWorkspace("t17");
  await soloWorkspace("x17", "STARTER");
  await prisma.workspace.update({ where: { id: "w_x17" }, data: { subscriptionStatus: "active", stripeCustomerId: "cus_x17" } });
  const token = await invite("w_t17", "x17@test.io");
  const snapshot = async () => ({
    workspace: await prisma.workspace.findUnique({ where: { id: "w_x17" } }),
    site: await prisma.siteProject.findUnique({ where: { id: "s_x17" } }),
    membership: await m.getMembership("u_x17"),
    targetMembers: await prisma.workspaceMember.count({ where: { workspaceId: "w_t17" } }),
    invite: await prisma.workspaceInvite.findFirst({ where: { workspaceId: "w_t17" } })
  });
  const before = await snapshot();

  assert.deepEqual(await teams.acceptInvite(token, user("x17"), T0), { error: "has_subscription" });
  assert.deepEqual(await snapshot(), before);
  assert.notEqual(before.workspace, null);
  assert.equal(before.invite?.acceptedAt, null);
});

test("accepting an invite to one's own workspace is refused", { skip }, async () => {
  await soloWorkspace("t8");
  await addMember("w_t8", "m8");
  // createInvite already refuses members of this workspace.
  assert.deepEqual(await teams.createInvite("w_t8", "u_t8", "T8@test.io", T0), { error: "already_member" });
  assert.deepEqual(await teams.createInvite("w_t8", "u_t8", "m8@test.io", T0), { error: "already_member" });

  // An invite row that predates the membership (e.g. created before the user joined).
  const { createHash } = await import("node:crypto");
  const token = "own-workspace-token";
  await prisma.workspaceInvite.create({
    data: {
      workspaceId: "w_t8",
      email: "t8@test.io",
      tokenHash: createHash("sha256").update(token).digest("hex"),
      invitedById: "u_t8",
      expiresAt: new Date(T0.getTime() + DAY_MS)
    }
  });

  assert.deepEqual(await teams.acceptInvite(token, user("t8"), T0), { error: "already_member" });
  assert.deepEqual(await m.getMembership("u_t8"), {
    id: (await prisma.workspaceMember.findUniqueOrThrow({ where: { userId: "u_t8" } })).id,
    workspaceId: "w_t8",
    role: "OWNER"
  });
  assert.notEqual(await prisma.siteProject.findUnique({ where: { id: "s_t8" } }), null);
});

test("a member of another team cannot join", { skip }, async () => {
  await soloWorkspace("t9");
  await soloWorkspace("o9");
  await addMember("w_o9", "m9");
  const token = await invite("w_t9", "m9@test.io");

  assert.deepEqual(await teams.acceptInvite(token, user("m9"), T0), { error: "has_team" });
  assert.equal((await m.getMembership("u_m9"))?.workspaceId, "w_o9");
});

test("the owner cannot be removed", { skip }, async () => {
  await soloWorkspace("t14");
  await soloWorkspace("o14");
  await addMember("w_o14", "m14");

  await assert.rejects(teams.removeMember("w_t14", "u_t14"));
  assert.equal((await m.getMembership("u_t14"))?.role, "OWNER");
  // Nor can a member be removed through another workspace.
  await assert.rejects(teams.removeMember("w_t14", "u_m14"));
  assert.equal((await m.getMembership("u_m14"))?.workspaceId, "w_o14");
});

test("removing a member deletes their hub sessions", { skip }, async () => {
  await soloWorkspace("t15");
  await addMember("w_t15", "m15");
  const expires = new Date(Date.now() + DAY_MS);
  await prisma.session.create({ data: { sessionToken: "sess_m15", userId: "u_m15", expires } });
  await prisma.session.create({ data: { sessionToken: "sess_t15", userId: "u_t15", expires } });

  await teams.removeMember("w_t15", "u_m15");

  assert.equal(await m.getMembership("u_m15"), null);
  assert.equal(await prisma.session.count({ where: { userId: "u_m15" } }), 0);
  assert.equal(await prisma.session.count({ where: { userId: "u_t15" } }), 1);
  assert.equal(await teams.isMemberActive("u_m15"), null);
  assert.deepEqual(await teams.isMemberActive("u_t15"), { workspaceId: "w_t15", role: "OWNER" });
});

test("a removed member can be invited again and accept", { skip }, async () => {
  await soloWorkspace("t10");
  await soloWorkspace("x10");
  const first = await invite("w_t10", "x10@test.io");
  assert.deepEqual(await teams.acceptInvite(first, user("x10"), T0), { workspaceId: "w_t10" });
  await teams.removeMember("w_t10", "u_x10");
  assert.equal(await m.getMembership("u_x10"), null);

  const second = await invite("w_t10", "x10@test.io");
  assert.notEqual(second, first);
  assert.deepEqual(await teams.acceptInvite(first, user("x10"), T0), { error: "invalid" });
  assert.deepEqual(await teams.acceptInvite(second, user("x10"), T0), { workspaceId: "w_t10" });
  assert.equal((await m.getMembership("u_x10"))?.role, "MEMBER");
});

test("re-inviting a pending email replaces its token without taking another seat", { skip }, async () => {
  await soloWorkspace("t11", "PRO");
  await addMember("w_t11", "m11");
  const first = await invite("w_t11", "x11@test.io");
  const later = new Date(T0.getTime() + DAY_MS);
  const second = await invite("w_t11", "x11@test.io", later);

  assert.notEqual(second, first);
  const row = await prisma.workspaceInvite.findFirstOrThrow({ where: { workspaceId: "w_t11", email: "x11@test.io" } });
  assert.equal(row.expiresAt.getTime(), later.getTime() + 7 * DAY_MS);
  assert.equal(await prisma.workspaceInvite.count({ where: { workspaceId: "w_t11" } }), 1);

  await soloWorkspace("x11");
  assert.deepEqual(await teams.acceptInvite(first, user("x11"), later), { error: "invalid" });
  assert.deepEqual(await teams.acceptInvite(second, user("x11"), later), { workspaceId: "w_t11" });
});

test("listTeam shows members and pending invites; revokeInvite removes one", { skip }, async () => {
  await soloWorkspace("t12");
  await addMember("w_t12", "m12");
  await invite("w_t12", "p12@test.io");

  const team = await teams.listTeam("w_t12");
  assert.deepEqual(
    team.members.map((x) => [x.userId, x.email, x.role]),
    [
      ["u_t12", "t12@test.io", "OWNER"],
      ["u_m12", "m12@test.io", "MEMBER"]
    ]
  );
  assert.deepEqual(team.invites.map((i) => i.email), ["p12@test.io"]);

  // Another workspace cannot revoke it.
  await teams.revokeInvite("w_t11", team.invites[0].id);
  assert.equal((await teams.listTeam("w_t12")).invites.length, 1);

  await teams.revokeInvite("w_t12", team.invites[0].id);
  assert.deepEqual((await teams.listTeam("w_t12")).invites, []);
});

test("a legacy owner without a member row cannot accept an invite to their own workspace", { skip }, async () => {
  await soloWorkspace("t13");
  await prisma.workspaceMember.delete({ where: { userId: "u_t13" } });
  const token = await invite("w_t13", "t13@test.io");

  assert.deepEqual(await teams.acceptInvite(token, user("t13"), T0), { error: "already_member" });
  assert.notEqual(await prisma.workspace.findUnique({ where: { id: "w_t13" } }), null);
  assert.notEqual(await prisma.siteProject.findUnique({ where: { id: "s_t13" } }), null);
});

test("hasPendingInvite is true only for a live, unaccepted invite", { skip }, async () => {
  await soloWorkspace("t30");
  await invite("w_t30", "p30@test.io");

  assert.equal(await teams.hasPendingInvite("P30@Test.io ", T0), true);
  assert.equal(await teams.hasPendingInvite("other30@test.io", T0), false);
  assert.equal(await teams.hasPendingInvite("", T0), false);
  assert.equal(await teams.hasPendingInvite("p30@test.io", new Date(T0.getTime() + 8 * DAY_MS)), false);

  await prisma.workspaceInvite.updateMany({ where: { workspaceId: "w_t30" }, data: { acceptedAt: T0 } });
  assert.equal(await teams.hasPendingInvite("p30@test.io", T0), false);
});

test("isTeamMemberEmail is true only for a MEMBER", { skip }, async () => {
  await soloWorkspace("t31");
  await addMember("w_t31", "m31");

  assert.equal(await teams.isTeamMemberEmail("M31@test.io"), true);
  assert.equal(await teams.isTeamMemberEmail("t31@test.io"), false);
  assert.equal(await teams.isTeamMemberEmail("nobody31@test.io"), false);
  assert.equal(await teams.isTeamMemberEmail(null), false);
});

test("moving a workspace brings its sites, articles and usage and makes the owner a member", { skip }, async () => {
  await soloWorkspace("t40", "PRO");
  await soloWorkspace("t41", "STARTER");
  await prisma.article.create({
    data: { id: "art_t41", siteProjectId: "s_t41", title: "T", slug: "t", contentHtml: "<p>x</p>", contentMarkdown: "x" }
  });
  await prisma.aiUsage.create({ data: { id: "au_t41", workspaceId: "w_t41", kind: "ARTICLE" } });

  assert.deepEqual(await teams.moveWorkspaceInto("w_t41", "w_t40", T0), { sites: 1 });

  assert.equal((await prisma.siteProject.findUniqueOrThrow({ where: { id: "s_t41" } })).workspaceId, "w_t40");
  assert.equal((await prisma.article.findUniqueOrThrow({ where: { id: "art_t41" } })).siteProjectId, "s_t41");
  assert.equal((await prisma.aiUsage.findUniqueOrThrow({ where: { id: "au_t41" } })).workspaceId, "w_t40");
  assert.equal((await prisma.brandProfile.count({ where: { siteProjectId: "s_t41" } })), 1);
  const member = await prisma.workspaceMember.findUniqueOrThrow({ where: { userId: "u_t41" } });
  assert.deepEqual([member.workspaceId, member.role], ["w_t40", "MEMBER"]);
  assert.equal(await prisma.workspace.findUnique({ where: { id: "w_t41" } }), null);
});

test("moving a workspace with a live subscription is refused and changes nothing", { skip }, async () => {
  await soloWorkspace("t42");
  await soloWorkspace("t43");
  await prisma.workspace.update({ where: { id: "w_t43" }, data: { subscriptionStatus: "active" } });

  await assert.rejects(teams.moveWorkspaceInto("w_t43", "w_t42", T0), /subscription/);
  assert.notEqual(await prisma.workspace.findUnique({ where: { id: "w_t43" } }), null);
  assert.equal((await prisma.siteProject.findUniqueOrThrow({ where: { id: "s_t43" } })).workspaceId, "w_t43");
});

test("moving a workspace into itself is refused", { skip }, async () => {
  await soloWorkspace("t44");
  await assert.rejects(teams.moveWorkspaceInto("w_t44", "w_t44", T0), /same/);
  assert.equal((await prisma.workspaceMember.findUniqueOrThrow({ where: { userId: "u_t44" } })).role, "OWNER");
  assert.equal((await prisma.siteProject.count({ where: { workspaceId: "w_t44" } })), 1);
});

test("moving a workspace that has a second member is refused", { skip }, async () => {
  await soloWorkspace("t45");
  await soloWorkspace("t46");
  await addMember("w_t46", "m46");

  await assert.rejects(teams.moveWorkspaceInto("w_t46", "w_t45", T0), /other members/);
  assert.notEqual(await prisma.workspace.findUnique({ where: { id: "w_t46" } }), null);
  assert.equal(await prisma.workspaceMember.count({ where: { workspaceId: "w_t46" } }), 2);
});

test("moving a workspace into a full team is refused", { skip }, async () => {
  await soloWorkspace("t47", "STARTER");
  await soloWorkspace("t48");

  await assert.rejects(teams.moveWorkspaceInto("w_t48", "w_t47", T0), /no free seat/);
  assert.notEqual(await prisma.workspace.findUnique({ where: { id: "w_t48" } }), null);
});

test("moving counts the owner's own pending invite as the seat they take and accepts it", { skip }, async () => {
  await soloWorkspace("t49", "PRO");
  await addMember("w_t49", "m49");
  await soloWorkspace("t51");
  // Pro: 3 seats = owner + member + the invite to t51.
  await invite("w_t49", "T51@test.io");

  assert.deepEqual(await teams.moveWorkspaceInto("w_t51", "w_t49", T0), { sites: 1 });
  assert.equal((await prisma.workspaceInvite.findFirstOrThrow({ where: { workspaceId: "w_t49" } })).acceptedAt?.getTime(), T0.getTime());
  assert.equal(await prisma.workspaceMember.count({ where: { workspaceId: "w_t49" } }), 3);
});

test("moving more sites than the destination plan allows is refused", { skip }, async () => {
  await soloWorkspace("t52", "PRO");
  await soloWorkspace("t53");
  const limit = (await import("../lib/entitlements")).limitsFor("PRO")!.sites;
  for (let i = 0; i < limit; i++) {
    await prisma.siteProject.create({ data: { id: `s_t53_${i}`, workspaceId: "w_t53", name: `S${i}`, domain: "https://x.test" } });
  }
  await assert.rejects(teams.moveWorkspaceInto("w_t53", "w_t52", T0), /allows/);
  assert.notEqual(await prisma.workspace.findUnique({ where: { id: "w_t53" } }), null);
});

test("an expired Checkout clears only the workspace that still points at it", { skip }, async () => {
  const { clearExpiredCheckout } = await import("../lib/billing");
  await prisma.user.create({ data: { id: "u_cx1", email: "cx1@test.io" } });
  await prisma.user.create({ data: { id: "u_cx2", email: "cx2@test.io" } });
  await prisma.workspace.create({ data: { id: "w_cx1", ownerId: "u_cx1", pendingCheckoutSessionId: "cs_old" } });
  await prisma.workspace.create({ data: { id: "w_cx2", ownerId: "u_cx2", pendingCheckoutSessionId: "cs_newer" } });

  assert.equal(await clearExpiredCheckout("cs_old"), 1);
  assert.equal(await clearExpiredCheckout("cs_unknown"), 0);
  const rows = await prisma.workspace.findMany({ where: { id: { in: ["w_cx1", "w_cx2"] } }, orderBy: { id: "asc" }, select: { pendingCheckoutSessionId: true } });
  assert.deepEqual(rows.map((row) => row.pendingCheckoutSessionId), [null, "cs_newer"]);
});
