import { Prisma, type PrismaClient } from "@prisma/client";

type ConnectionData = Omit<Prisma.SiteSocialConnectionUncheckedCreateInput, "siteProjectId" | "id" | "connectedAt" | "updatedAt" | "provider">;

/**
 * Creates or replaces the site's Meta connection, only while the site still belongs to `workspaceId`. The site row is
 * locked first, so a transfer (which updates that row, then deletes the connection) cannot interleave: a connection
 * authorised by the previous workspace is either deleted by the transfer or never written. False when not saved.
 */
export async function saveConnection(db: PrismaClient, siteProjectId: string, workspaceId: string, data: ConnectionData): Promise<boolean> {
  try {
    return await db.$transaction(async (tx) => {
      const owned = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "SiteProject" WHERE id = ${siteProjectId} AND "workspaceId" = ${workspaceId} FOR UPDATE`;
      if (owned.length === 0) return false;
      await tx.siteSocialConnection.upsert({ where: { siteProjectId }, create: { siteProjectId, ...data }, update: data });
      return true;
    });
  } catch (error) {
    // Two saves raced on the unique row: the site lock serialises them, but a concurrent first insert can still collide.
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
    return saveConnection(db, siteProjectId, workspaceId, data);
  }
}
