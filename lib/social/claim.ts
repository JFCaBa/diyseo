import type { Prisma, PrismaClient } from "@prisma/client";

import { UNKNOWN_AFTER_MS } from "@/lib/social/rules";

/** Atomically moves a DRAFT/FAILED post of this site to PUBLISHING under `attemptId`. True only for the one winner. */
export async function claimSocialPost(
  db: Pick<PrismaClient, "socialPost">,
  { postId, siteProjectId, attemptId }: { postId: string; siteProjectId: string; attemptId: string }
): Promise<boolean> {
  const { count } = await db.socialPost.updateMany({
    where: { id: postId, siteProjectId, status: { in: ["DRAFT", "FAILED"] } },
    // The previous error stays until this attempt writes its own outcome (a blocked release keeps it).
    data: { status: "PUBLISHING", attemptId }
  });
  return count === 1;
}

/**
 * Writes the outcome of a publish attempt, only while that same attempt still holds the post (PUBLISHING with its
 * attemptId). False when the user resolved the post meanwhile or another attempt took over: nothing is written.
 */
export async function finishAttempt(
  db: Pick<PrismaClient, "socialPost">,
  { postId, siteProjectId, attemptId }: { postId: string; siteProjectId: string; attemptId: string },
  data: Prisma.SocialPostUpdateManyMutationInput
): Promise<boolean> {
  const { count } = await db.socialPost.updateMany({ where: { id: postId, siteProjectId, attemptId, status: "PUBLISHING" }, data });
  return count === 1;
}

/**
 * The user's answer to an UNKNOWN post. Written only if the attempt is still the same one and has not been refreshed
 * for UNKNOWN_AFTER_MS (an attempt that is about to publish refreshes updatedAt, so it can never be resolved under it).
 */
export async function resolveUnknown(
  db: Pick<PrismaClient, "socialPost">,
  { postId, siteProjectId, attemptId }: { postId: string; siteProjectId: string; attemptId: string | null },
  outcome: "published" | "retry",
  now: Date
): Promise<boolean> {
  const { count } = await db.socialPost.updateMany({
    where: { id: postId, siteProjectId, attemptId, status: "PUBLISHING", updatedAt: { lt: new Date(now.getTime() - UNKNOWN_AFTER_MS) } },
    data:
      outcome === "published"
        ? { status: "PUBLISHED", publishedAt: now, error: null, attemptId: null }
        : { status: "FAILED", error: null, attemptId: null }
  });
  return count === 1;
}
