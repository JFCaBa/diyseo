import { createHash, randomBytes } from "node:crypto";

import { Prisma } from "@prisma/client";

import { effectivePlan, limitsFor } from "@/lib/entitlements";
import { prisma } from "@/lib/prisma";
import { lockWorkspace } from "@/lib/quota";
import { memberLimit } from "@/lib/satellite-entitlements";
import { canChangeRole, type RoleChangeError, type TeamRole } from "@/lib/team-roles";
import { getMembership, type WorkspaceRole } from "@/lib/workspace-membership";

type Tx = Prisma.TransactionClient;

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Why a user's own workspace cannot be dropped to join another one. */
export type JoinBlocker = "has_content" | "has_subscription" | "has_team" | null;

/** Subscription states that no longer bill or grant anything. */
const ENDED_SUBSCRIPTION = ["canceled", "incomplete_expired"];

export function joinBlocker(ws: {
  articles: number;
  keywords: number;
  aiUsage: number;
  members: number;
  pendingInvites: number;
  subscriptionStatus: string | null;
  pendingCheckoutSessionId: string | null;
}): JoinBlocker {
  if (ws.members > 1 || ws.pendingInvites > 0) return "has_team";
  if (
    ws.pendingCheckoutSessionId !== null ||
    (ws.subscriptionStatus !== null && !ENDED_SUBSCRIPTION.includes(ws.subscriptionStatus))
  ) {
    return "has_subscription";
  }
  if (ws.articles > 0 || ws.keywords > 0 || ws.aiUsage > 0) return "has_content";
  return null;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** Postgres aborted the transaction as a serialization conflict (P2034 / 40001) or a deadlock (40P01). */
function isRetryableConflict(error: unknown) {
  const deadlockText = (message: string) =>
    message.includes("40P01") || message.includes("40001") || /deadlock detected/i.test(message);
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2034") return true;
    // Raw queries (the advisory lock) report the Postgres code in meta.
    const meta = (error.meta ?? {}) as Record<string, unknown>;
    return meta.code === "40P01" || meta.code === "40001" || deadlockText(error.message);
  }
  return error instanceof Prisma.PrismaClientUnknownRequestError && deadlockText(error.message);
}

const TEAM_TX_ATTEMPTS = 3;
// Jittered wait before each retry: [min, max) ms.
const RETRY_BACKOFF_MS: [number, number][] = [
  [20, 80],
  [50, 150]
];

function backoff(retry: number) {
  const [min, max] = RETRY_BACKOFF_MS[Math.min(retry, RETRY_BACKOFF_MS.length - 1)];
  return new Promise((resolve) => setTimeout(resolve, min + Math.random() * (max - min)));
}

/**
 * Runs a membership-changing operation: Serializable, holding the advisory lock
 * of every workspace it touches, taken in a fixed order. A lock taken later
 * inside `fn` (or row locks under concurrent writers) can still deadlock, so
 * serialization conflicts and deadlocks are retried with a short backoff,
 * 3 attempts in total.
 */
async function inTeamTransaction<T>(workspaceIds: string[], fn: (tx: Tx) => Promise<T>): Promise<T> {
  const ordered = [...new Set(workspaceIds)].sort();
  const run = () =>
    prisma.$transaction(
      async (tx) => {
        for (const id of ordered) await lockWorkspace(tx, id);
        return fn(tx);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

  for (let attempt = 1; ; attempt++) {
    try {
      return await run();
    } catch (error) {
      if (attempt >= TEAM_TX_ATTEMPTS || !isRetryableConflict(error)) throw error;
      await backoff(attempt - 1);
    }
  }
}

function pendingInviteWhere(workspaceId: string, now: Date): Prisma.WorkspaceInviteWhereInput {
  return { workspaceId, acceptedAt: null, expiresAt: { gt: now } };
}

/** True when one more seat (member or pending invite) would exceed the plan in force. */
async function seatLimitReached(tx: Tx, workspaceId: string, now: Date, excludeInvite: Prisma.WorkspaceInviteWhereInput) {
  const workspace = await tx.workspace.findUnique({ where: { id: workspaceId }, select: { plan: true, trialEndsAt: true } });
  if (!workspace) throw new Error("Not found");

  const limit = memberLimit(effectivePlan(workspace, now));
  if (limit === null) return false;

  const members = await tx.workspaceMember.count({ where: { workspaceId } });
  const pending = await tx.workspaceInvite.count({ where: { ...pendingInviteWhere(workspaceId, now), NOT: excludeInvite } });
  return members + pending + 1 > limit;
}

/**
 * Invites an email to the workspace. Re-inviting the same email (pending,
 * expired or used before) replaces its token and expiry, so the old link stops
 * working. Pending invites take a seat until they expire.
 */
export async function createInvite(
  workspaceId: string,
  invitedById: string,
  email: string,
  now: Date
): Promise<{ token: string } | { error: "limit_reached" | "already_member" }> {
  const normalized = normalizeEmail(email);
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(now.getTime() + INVITE_TTL_MS);

  return inTeamTransaction([workspaceId], async (tx) => {
    const existingMember = await tx.workspaceMember.findFirst({
      where: { workspaceId, user: { email: { equals: normalized, mode: "insensitive" } } },
      select: { id: true }
    });
    if (existingMember) return { error: "already_member" as const };

    // This email's own invite is being replaced, so it does not count as another seat.
    if (await seatLimitReached(tx, workspaceId, now, { email: normalized })) {
      return { error: "limit_reached" as const };
    }

    await tx.workspaceInvite.upsert({
      where: { workspaceId_email: { workspaceId, email: normalized } },
      create: { workspaceId, email: normalized, tokenHash, invitedById, expiresAt },
      update: { tokenHash, invitedById, expiresAt, acceptedAt: null }
    });

    return { token };
  });
}

/** The workspace the user leaves when joining: the one they are the primary owner of, if any. A co-owner owns nothing. */
async function ownedWorkspaceForJoin(tx: Tx | typeof prisma, userId: string) {
  const owned = await tx.workspace.findUnique({ where: { ownerId: userId }, select: { id: true } });
  return owned?.id ?? null;
}

async function joinBlockerFor(tx: Tx, workspaceId: string, now: Date): Promise<JoinBlocker> {
  const workspace = await tx.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    select: { subscriptionStatus: true, pendingCheckoutSessionId: true }
  });
  const site = { siteProject: { workspaceId } };

  return joinBlocker({
    articles: await tx.article.count({ where: site }),
    keywords: await tx.keyword.count({ where: site }),
    aiUsage: await tx.aiUsage.count({ where: { workspaceId } }),
    members: await tx.workspaceMember.count({ where: { workspaceId } }),
    pendingInvites: await tx.workspaceInvite.count({ where: pendingInviteWhere(workspaceId, now) }),
    subscriptionStatus: workspace.subscriptionStatus,
    pendingCheckoutSessionId: workspace.pendingCheckoutSessionId
  });
}

/**
 * Accepts an invite: the user becomes a MEMBER of the inviting workspace and
 * the empty workspace they owned is deleted (its sites and brand profiles go
 * with it). Anything that would lose data or a subscription refuses instead.
 */
export async function acceptInvite(
  token: string,
  user: { id: string; email: string },
  now: Date
): Promise<
  | { workspaceId: string }
  | { error: "invalid" | "expired" | "email_mismatch" | "limit_reached" | "already_member" | NonNullable<JoinBlocker> }
> {
  const tokenHash = hashToken(token);
  // Only to learn which workspaces to lock; everything is re-read inside the transaction.
  const target = await prisma.workspaceInvite.findUnique({ where: { tokenHash }, select: { workspaceId: true } });
  if (!target) return { error: "invalid" };
  const sourceBeforeLock = await ownedWorkspaceForJoin(prisma, user.id);
  const locked = [target.workspaceId, ...(sourceBeforeLock ? [sourceBeforeLock] : [])];

  return inTeamTransaction(locked, async (tx) => {
    const invite = await tx.workspaceInvite.findUnique({ where: { tokenHash } });
    if (!invite || invite.acceptedAt) return { error: "invalid" as const };
    if (invite.expiresAt.getTime() <= now.getTime()) return { error: "expired" as const };
    if (normalizeEmail(invite.email) !== normalizeEmail(user.email)) return { error: "email_mismatch" as const };

    const membership = await tx.workspaceMember.findUnique({ where: { userId: user.id }, select: { workspaceId: true, role: true } });
    if (membership?.workspaceId === invite.workspaceId) return { error: "already_member" as const };

    // The invite being accepted stops being pending and becomes the new member.
    if (await seatLimitReached(tx, invite.workspaceId, now, { id: invite.id })) {
      return { error: "limit_reached" as const };
    }

    const source = await ownedWorkspaceForJoin(tx, user.id);
    // Members and co-owners of a team have no workspace of their own to fold in.
    if (membership && !source) return { error: "has_team" as const };

    // A legacy owner without a member row, invited to their own workspace.
    if (source === invite.workspaceId) return { error: "already_member" as const };
    if (source) {
      // Billing and AI credits take this lock too, so neither can change the workspace while it is checked and deleted.
      if (!locked.includes(source)) await lockWorkspace(tx, source);
      const blocker = await joinBlockerFor(tx, source, now);
      if (blocker) return { error: blocker };
      // Every relation under Workspace and SiteProject cascades.
      await tx.workspace.delete({ where: { id: source } });
    }

    await tx.workspaceMember.create({ data: { workspaceId: invite.workspaceId, userId: user.id, role: "MEMBER" } });
    await tx.workspaceInvite.update({ where: { id: invite.id }, data: { acceptedAt: now } });

    return { workspaceId: invite.workspaceId };
  });
}

/**
 * One-off admin operation: folds a solo owner's workspace into a team
 * workspace. Their sites (with articles, keywords and brand profile) and AI
 * usage move over, the owner becomes a MEMBER of `into`, and the emptied
 * source workspace is deleted. Refuses (throws, nothing changes) when the
 * source has a team or a live subscription, or the destination has no free seat.
 */
export async function moveWorkspaceInto(
  fromWorkspaceId: string,
  intoWorkspaceId: string,
  now: Date = new Date()
): Promise<{ sites: number }> {
  if (fromWorkspaceId === intoWorkspaceId) throw new Error("The source and destination workspaces are the same.");

  return inTeamTransaction([fromWorkspaceId, intoWorkspaceId], async (tx) => {
    const source = await tx.workspace.findUnique({ where: { id: fromWorkspaceId }, select: { ownerId: true } });
    if (!source) throw new Error(`Source workspace ${fromWorkspaceId} not found.`);
    if (!(await tx.workspace.findUnique({ where: { id: intoWorkspaceId }, select: { id: true } }))) {
      throw new Error(`Destination workspace ${intoWorkspaceId} not found.`);
    }

    const blocker = await joinBlockerFor(tx, fromWorkspaceId, now);
    if (blocker === "has_team") throw new Error("The source workspace has other members or pending invites.");
    if (blocker === "has_subscription") throw new Error("The source workspace has a live subscription or a pending checkout.");

    // An invite already sent to the owner is the seat they are about to take, not another one.
    const owner = await tx.user.findUnique({ where: { id: source.ownerId }, select: { email: true } });
    const ownerInvite = owner?.email
      ? await tx.workspaceInvite.findFirst({
          where: { ...pendingInviteWhere(intoWorkspaceId, now), email: { equals: normalizeEmail(owner.email), mode: "insensitive" } },
          select: { id: true }
        })
      : null;
    if (await seatLimitReached(tx, intoWorkspaceId, now, ownerInvite ? { id: ownerInvite.id } : { id: "" })) {
      throw new Error("The destination workspace has no free seat (pending invites count).");
    }

    const incoming = await tx.siteProject.count({ where: { workspaceId: fromWorkspaceId } });
    const destination = await tx.workspace.findUniqueOrThrow({ where: { id: intoWorkspaceId }, select: { plan: true, trialEndsAt: true } });
    const limits = limitsFor(effectivePlan(destination, now));
    if (limits && (await tx.siteProject.count({ where: { workspaceId: intoWorkspaceId } })) + incoming > limits.sites) {
      throw new Error(`The destination plan allows ${limits.sites} site(s); moving ${incoming} more would exceed it.`);
    }

    // userId is unique: the owner's single membership row moves; a second one is never created.
    const membership = await tx.workspaceMember.findUnique({ where: { userId: source.ownerId }, select: { id: true, workspaceId: true } });
    if (membership && membership.workspaceId !== fromWorkspaceId) {
      throw new Error("The source owner already belongs to another workspace.");
    }

    const { count: sites } = await tx.siteProject.updateMany({ where: { workspaceId: fromWorkspaceId }, data: { workspaceId: intoWorkspaceId } });
    await tx.aiUsage.updateMany({ where: { workspaceId: fromWorkspaceId }, data: { workspaceId: intoWorkspaceId } });

    if (membership) {
      await tx.workspaceMember.update({ where: { id: membership.id }, data: { workspaceId: intoWorkspaceId, role: "MEMBER" } });
    } else {
      // A legacy owner without a member row.
      await tx.workspaceMember.create({ data: { workspaceId: intoWorkspaceId, userId: source.ownerId, role: "MEMBER" } });
    }

    if (ownerInvite) await tx.workspaceInvite.update({ where: { id: ownerInvite.id }, data: { acceptedAt: now } });

    // Members, invites, sites and AI usage are the only relations under Workspace; all emptied or moved above.
    await tx.workspace.delete({ where: { id: fromWorkspaceId } });
    return { sites };
  });
}

/** Removes a MEMBER and signs them out of the hub. Throws for the OWNER or a non-member. */
export async function removeMember(workspaceId: string, userId: string): Promise<void> {
  await inTeamTransaction([workspaceId], async (tx) => {
    const member = await tx.workspaceMember.findUnique({ where: { userId }, select: { id: true, workspaceId: true, role: true } });
    if (!member || member.workspaceId !== workspaceId) throw new Error("Not found");
    if (member.role === "OWNER") throw new Error("The owner cannot be removed.");

    // Delete exactly the row read, so a membership created meanwhile elsewhere is never touched.
    const { count } = await tx.workspaceMember.deleteMany({ where: { id: member.id, workspaceId, role: "MEMBER" } });
    if (count !== 1) throw new Error("Not found");
    await tx.session.deleteMany({ where: { userId } });
  });
}

/**
 * Appoints or revokes a co-owner (see canChangeRole). The actor is re-read inside the lock, so an owner demoted a moment
 * ago cannot still act. Returns the refusal, or null when the role changed.
 */
export async function setMemberRole(
  workspaceId: string,
  actorUserId: string,
  targetUserId: string,
  nextRole: TeamRole
): Promise<RoleChangeError | "not_found" | null> {
  return inTeamTransaction([workspaceId], async (tx) => {
    const workspace = await tx.workspace.findUnique({ where: { id: workspaceId }, select: { ownerId: true } });
    const members = await tx.workspaceMember.findMany({
      where: { workspaceId, userId: { in: [actorUserId, targetUserId] } },
      select: { id: true, userId: true, role: true }
    });
    const actor = members.find((m) => m.userId === actorUserId);
    const target = members.find((m) => m.userId === targetUserId);
    if (!workspace || !target || actor?.role !== "OWNER") return "not_found" as const;

    const decision = canChangeRole({
      actorUserId,
      primaryOwnerId: workspace.ownerId,
      targetUserId,
      targetRole: target.role as TeamRole,
      nextRole
    });
    if (!decision.ok) return decision.error;

    const { count } = await tx.workspaceMember.updateMany({
      where: { id: target.id, workspaceId, role: target.role },
      data: { role: nextRole }
    });
    return count === 1 ? null : ("not_found" as const);
  });
}

/** Members (owner first) and invites not yet accepted, expired ones included. */
export async function listTeam(workspaceId: string): Promise<{
  /** The main owner (billing holder); every other OWNER member is a co-owner. */
  primaryOwnerId: string | null;
  members: { userId: string; email: string; name: string | null; role: WorkspaceRole }[];
  invites: { id: string; email: string; expiresAt: Date }[];
}> {
  const [workspace, members, invites] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: workspaceId }, select: { ownerId: true } }),
    prisma.workspaceMember.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "asc" },
      select: { userId: true, role: true, user: { select: { email: true, name: true } } }
    }),
    prisma.workspaceInvite.findMany({
      where: { workspaceId, acceptedAt: null },
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true, expiresAt: true }
    })
  ]);

  return {
    primaryOwnerId: workspace?.ownerId ?? null,
    members: members
      .map((m) => ({ userId: m.userId, email: m.user.email ?? "", name: m.user.name, role: m.role as WorkspaceRole }))
      .sort((a, b) => Number(b.role === "OWNER") - Number(a.role === "OWNER")),
    invites
  };
}

/** Deletes a pending invite of this workspace; anything else is a no-op. */
export async function revokeInvite(workspaceId: string, inviteId: string): Promise<void> {
  await prisma.workspaceInvite.deleteMany({ where: { id: inviteId, workspaceId, acceptedAt: null } });
}

/** What the invite page shows for a token: the invited email, the workspace, and whether it can still be accepted. */
export async function inviteForToken(
  token: string,
  now: Date
): Promise<{ email: string; workspaceId: string; workspaceName: string; usable: boolean } | null> {
  if (!token) return null;
  const invite = await prisma.workspaceInvite.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { email: true, workspaceId: true, acceptedAt: true, expiresAt: true, workspace: { select: { name: true } } }
  });
  if (!invite) return null;
  return {
    email: invite.email,
    workspaceId: invite.workspaceId,
    workspaceName: invite.workspace.name,
    usable: invite.acceptedAt === null && invite.expiresAt.getTime() > now.getTime()
  };
}

/** True when an invite for this email is neither accepted nor expired, in any workspace. Lets invited people sign up while sign-up is closed. */
export async function hasPendingInvite(email: string | null | undefined, now: Date = new Date()): Promise<boolean> {
  const normalized = email ? normalizeEmail(email) : "";
  if (!normalized) return false;
  const invite = await prisma.workspaceInvite.findFirst({
    where: { email: normalized, acceptedAt: null, expiresAt: { gt: now } },
    select: { id: true }
  });
  return invite !== null;
}

/**
 * True when a user with this email is a member or co-owner of a team, so they keep signing in after accepting while
 * sign-up is closed. A workspace's primary owner is not covered: they sign in through the usual access list.
 */
export async function isTeamMemberEmail(email: string | null | undefined): Promise<boolean> {
  const normalized = email ? normalizeEmail(email) : "";
  if (!normalized) return false;
  const member = await prisma.workspaceMember.findFirst({
    where: { user: { email: { equals: normalized, mode: "insensitive" } } },
    select: { userId: true, role: true, workspace: { select: { ownerId: true } } }
  });
  return member !== null && (member.role === "MEMBER" || member.workspace.ownerId !== member.userId);
}

/** For token introspection by the satellites: the user's current membership, if any. */
export async function isMemberActive(userId: string): Promise<{ workspaceId: string; role: WorkspaceRole } | null> {
  const membership = await getMembership(userId);
  return membership ? { workspaceId: membership.workspaceId, role: membership.role } : null;
}
