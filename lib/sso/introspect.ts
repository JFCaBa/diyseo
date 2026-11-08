import { effectivePlan, type WorkspacePlan } from "@/lib/entitlements";
import { prisma } from "@/lib/prisma";
import { satelliteGrant, type SatelliteGrant } from "@/lib/satellite-entitlements";
import type { WorkspaceRole } from "@/lib/workspace-membership";

export type UserIntrospection =
  | { active: false }
  | { active: true; wid: string; mid: string; role: WorkspaceRole; plan: WorkspacePlan; grant: SatelliteGrant };

export type WorkspaceIntrospection = { active: false } | { active: true; plan: WorkspacePlan; grant: SatelliteGrant };

/** Is this user still an active member, and what does their workspace's plan grant? */
export async function introspectUser(sub: string, now: Date): Promise<UserIntrospection> {
  const member = await prisma.workspaceMember.findUnique({
    where: { userId: sub },
    select: { id: true, role: true, workspace: { select: { id: true, plan: true, trialEndsAt: true } } },
  });
  if (!member) return { active: false };
  const plan = effectivePlan(member.workspace, now);
  return {
    active: true,
    wid: member.workspace.id,
    mid: member.id,
    role: member.role as WorkspaceRole,
    plan,
    grant: satelliteGrant(plan),
  };
}

/** What a workspace's plan grants. A workspace on no plan is still active, with an empty grant. */
export async function introspectWorkspace(wid: string, now: Date): Promise<WorkspaceIntrospection> {
  const workspace = await prisma.workspace.findUnique({ where: { id: wid }, select: { plan: true, trialEndsAt: true } });
  if (!workspace) return { active: false };
  const plan = effectivePlan(workspace, now);
  return { active: true, plan, grant: satelliteGrant(plan) };
}
