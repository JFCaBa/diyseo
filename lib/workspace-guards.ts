import { prisma } from "@/lib/prisma";

/*
 * Workspace scoping for every admin read and write. These take the caller's
 * workspaceId (from requireWorkspace or the session) and return null when the
 * record belongs to another workspace, so callers answer "not found".
 */

export async function findSiteInWorkspace(siteId: string, workspaceId: string): Promise<{ id: string } | null> {
  return prisma.siteProject.findFirst({ where: { id: siteId, workspaceId }, select: { id: true } });
}

export async function findArticleInWorkspace(
  articleId: string,
  workspaceId: string
): Promise<{ id: string; siteProjectId: string } | null> {
  return prisma.article.findFirst({
    where: { id: articleId, siteProject: { workspaceId } },
    select: { id: true, siteProjectId: true }
  });
}

export async function findKeywordInWorkspace(
  keywordId: string,
  workspaceId: string
): Promise<{ id: string; siteProjectId: string } | null> {
  return prisma.keyword.findFirst({
    where: { id: keywordId, siteProject: { workspaceId } },
    select: { id: true, siteProjectId: true }
  });
}

/** Throws Error("Not found") unless the site belongs to the workspace. */
export async function requireSiteInWorkspace(siteId: string, workspaceId: string): Promise<{ id: string }> {
  const site = await findSiteInWorkspace(siteId, workspaceId);
  if (!site) throw new Error("Not found");
  return site;
}

/** Throws Error("Not found") unless the article is in this workspace and under the given site. */
export async function requireArticleInSite(
  articleId: string,
  siteId: string,
  workspaceId: string
): Promise<{ id: string; siteProjectId: string }> {
  const article = await findArticleInWorkspace(articleId, workspaceId);
  if (!article || article.siteProjectId !== siteId) throw new Error("Not found");
  return article;
}

export function isNotFoundError(error: unknown): boolean {
  return error instanceof Error && error.message === "Not found";
}

/** The workspace's oldest site, used to pick where to land after sign-in. */
export async function firstSiteIdInWorkspace(workspaceId: string | null | undefined): Promise<string | null> {
  if (!workspaceId) return null;
  const site = await prisma.siteProject.findFirst({
    where: { workspaceId },
    orderBy: { createdAt: "asc" },
    select: { id: true }
  });
  return site?.id ?? null;
}
