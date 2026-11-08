import { notFound } from "next/navigation";

import { auth } from "@/lib/auth";
import { findSiteInWorkspace } from "@/lib/workspace-guards";
import type { WorkspaceRole } from "@/lib/workspace-membership";

/**
 * Identity for admin actions: the signed-in user and the workspace they belong
 * to. The session callback resolves the membership on every auth() call, so
 * this reads it from there. Throws Error("Unauthorized") with no session or no
 * membership.
 */
export async function requireWorkspace(): Promise<{ userId: string; workspaceId: string; role: WorkspaceRole }> {
  const session = await auth();
  const userId = session?.user?.id;
  const workspaceId = session?.user?.workspaceId;
  const role = session?.user?.workspaceRole;

  if (!userId || !workspaceId || !role) {
    throw new Error("Unauthorized");
  }

  return { userId, workspaceId, role };
}

/** Like requireWorkspace, and throws Error("Forbidden") unless the user is the workspace OWNER. */
export async function requireOwner(): Promise<{ userId: string; workspaceId: string }> {
  const { userId, workspaceId, role } = await requireWorkspace();

  if (role !== "OWNER") {
    throw new Error("Forbidden");
  }

  return { userId, workspaceId };
}

/**
 * For admin pages under app/[siteId]: resolves the caller's workspace and
 * answers 404 unless the site belongs to it. Each page calls this itself,
 * before loading anything, instead of relying on the layout's check.
 */
export async function requireSitePage(siteId: string): Promise<{ userId: string; workspaceId: string; role: WorkspaceRole }> {
  // Only "no session / no membership" becomes a 404; any other failure is a real error.
  const member = await requireWorkspace().catch((error: unknown) => {
    if (error instanceof Error && error.message === "Unauthorized") return null;
    throw error;
  });

  if (!member || !(await findSiteInWorkspace(siteId, member.workspaceId))) {
    notFound();
  }

  return member;
}
