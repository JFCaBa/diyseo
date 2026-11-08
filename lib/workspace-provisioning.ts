import { Prisma } from "@prisma/client";

import { planForNewWorkspace, trialEndForPlan } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getMembership, type WorkspaceRole } from "@/lib/workspace-membership";

type Membership = { id: string; workspaceId: string; role: WorkspaceRole };

const DEFAULT_SITE = {
  name: "My Site",
  domain: "https://example.com",
  brandProfile: { create: { contentLanguage: "en" } }
};

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** Re-reads the membership after a concurrent request created it first. */
async function membershipAfterRace(userId: string, error: unknown): Promise<Membership> {
  if (!isUniqueViolation(error)) throw error;
  const membership = await getMembership(userId);
  if (!membership) throw error;
  return membership;
}

/**
 * A workspace created before memberships existed has no member row; give its
 * owner one. The migration backfills these, so this is only a safety net.
 */
async function adoptOwnedWorkspace(userId: string): Promise<Membership | null> {
  const workspace = await prisma.workspace.findUnique({ where: { ownerId: userId }, select: { id: true } });
  if (!workspace) return null;

  try {
    const member = await prisma.workspaceMember.create({ data: { workspaceId: workspace.id, userId, role: "OWNER" } });
    return { id: member.id, workspaceId: workspace.id, role: "OWNER" };
  } catch (error) {
    return membershipAfterRace(userId, error);
  }
}

/** Creates a workspace and its OWNER member in one transaction. ownerId mirrors that member. */
async function createOwnedWorkspace(
  userId: string,
  userName: string | null | undefined,
  email: string | null | undefined,
  withDefaultSite: boolean
): Promise<Membership> {
  const plan = planForNewWorkspace(email);

  try {
    return await prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          plan,
          trialEndsAt: trialEndForPlan(plan, new Date()),
          ownerId: userId,
          name: userName?.trim() ? `${userName.trim()}'s Workspace` : "My Workspace",
          ...(withDefaultSite ? { sites: { create: DEFAULT_SITE } } : {})
        },
        select: { id: true }
      });
      const member = await tx.workspaceMember.create({ data: { workspaceId: workspace.id, userId, role: "OWNER" } });
      return { id: member.id, workspaceId: workspace.id, role: "OWNER" as const };
    });
  } catch (error) {
    return membershipAfterRace(userId, error);
  }
}

async function resolveOrCreateMembership(
  userId: string,
  userName: string | null | undefined,
  email: string | null | undefined,
  withDefaultSite: boolean
): Promise<Membership> {
  return (
    (await getMembership(userId)) ??
    (await adoptOwnedWorkspace(userId)) ??
    (await createOwnedWorkspace(userId, userName, email, withDefaultSite))
  );
}

/**
 * Guarantees the user belongs to a workspace. A user without one gets a new
 * workspace as its OWNER, and an owner's workspace always has at least one site.
 */
export async function ensureUserWorkspace(
  userId: string,
  userName?: string | null,
  email?: string | null
): Promise<Membership> {
  const membership = await resolveOrCreateMembership(userId, userName, email, true);

  if (membership.role === "OWNER") {
    const sites = await prisma.siteProject.count({ where: { workspaceId: membership.workspaceId } });

    if (sites === 0) {
      await prisma.siteProject.create({ data: { workspaceId: membership.workspaceId, ...DEFAULT_SITE } });
    }
  }

  return membership;
}

/** The workspace a user belongs to, creating an empty one they own if they have none. */
export async function getOrCreateWorkspaceIdForUser(
  userId: string,
  userName?: string | null,
  email?: string | null
): Promise<string> {
  return (await resolveOrCreateMembership(userId, userName, email, false)).workspaceId;
}

/** Workspace whose OWNER member is this user, or null. */
export async function findOwnedWorkspaceId(userId: string): Promise<string | null> {
  const membership = await getMembership(userId);
  return membership?.role === "OWNER" ? membership.workspaceId : null;
}
