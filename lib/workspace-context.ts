import { auth } from "@/lib/auth";
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
