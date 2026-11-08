import { prisma } from "@/lib/prisma";

export type WorkspaceRole = "OWNER" | "MEMBER";

export async function getMembership(
  userId: string
): Promise<{ id: string; workspaceId: string; role: WorkspaceRole } | null> {
  const m = await prisma.workspaceMember.findUnique({ where: { userId } });
  if (!m) return null;
  return { id: m.id, workspaceId: m.workspaceId, role: m.role as WorkspaceRole };
}
