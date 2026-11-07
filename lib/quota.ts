import type { Prisma } from "@prisma/client";

import { effectivePlan, limitsFor, monthStartUtc } from "@/lib/entitlements";
import { prisma } from "@/lib/prisma";

/** A limit that blocks the action. Its message is shown to the user as is. */
export class QuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuotaError";
  }
}

export function isQuotaError(error: unknown): error is QuotaError {
  return error instanceof QuotaError;
}

/**
 * A reservation that was never committed (the process died mid-generation)
 * stops counting after this long, so a crash cannot eat a credit for good.
 */
export const PENDING_CREDIT_TTL_MS = 15 * 60 * 1000;

export type CreditKind = "ARTICLE" | "TRANSLATION";

type Tx = Prisma.TransactionClient;

export function countsTowardQuota(usage: { status: string; createdAt: Date }, now: Date): boolean {
  if (usage.status === "COMMITTED") return true;
  return usage.status === "PENDING" && now.getTime() - usage.createdAt.getTime() < PENDING_CREDIT_TTL_MS;
}

/** Serializes every count-then-write for one workspace (credits, sites, Stripe sync). */
export async function lockWorkspace(tx: Tx, workspaceId: string) {
  // ::text because Prisma cannot read Postgres' void type.
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${workspaceId}))::text`;
}

async function limitsInTx(tx: Tx | typeof prisma, workspaceId: string, now: Date) {
  const workspace = await tx.workspace.findUnique({
    where: { id: workspaceId },
    select: { plan: true, trialEndsAt: true }
  });

  if (!workspace) {
    throw new Error("Workspace not found.");
  }

  const plan = effectivePlan(workspace, now);
  return { plan, limits: limitsFor(plan) };
}

function articleWhere(workspaceId: string, now: Date): Prisma.AiUsageWhereInput {
  return {
    workspaceId,
    createdAt: { gte: monthStartUtc(now) },
    OR: [
      { status: "COMMITTED" },
      { status: "PENDING", createdAt: { gte: new Date(now.getTime() - PENDING_CREDIT_TTL_MS) } }
    ]
  };
}

function noCreditMessage(plan: string, limit: number) {
  if (limit === 0) {
    return "Your trial has ended. Choose a plan at /billing to keep generating articles.";
  }

  return `You have used all ${limit} AI articles included in your ${plan.toLowerCase()} plan this month. Upgrade at /billing or wait until next month.`;
}

/**
 * Reserves one AI credit before calling the model. Count and insert happen
 * under the workspace lock, so two parallel requests cannot both take the last
 * credit. Commit it in the transaction that saves the result; release it if the
 * generation fails.
 */
export async function reserveArticleCredit(
  input: { workspaceId: string; siteProjectId: string; kind: CreditKind },
  now: Date = new Date()
): Promise<string> {
  return prisma.$transaction(async (tx) => {
    await lockWorkspace(tx, input.workspaceId);
    const { plan, limits } = await limitsInTx(tx, input.workspaceId, now);

    if (limits) {
      if (input.kind === "TRANSLATION" && !limits.translations) {
        throw new QuotaError(
          limits.articlesPerMonth === 0
            ? noCreditMessage(plan, 0)
            : "AI translations are included in the Pro and Agency plans. Upgrade at /billing."
        );
      }

      const used = await tx.aiUsage.count({ where: articleWhere(input.workspaceId, now) });

      if (used >= limits.articlesPerMonth) {
        throw new QuotaError(noCreditMessage(plan, limits.articlesPerMonth));
      }
    }

    const usage = await tx.aiUsage.create({
      data: { workspaceId: input.workspaceId, siteProjectId: input.siteProjectId, kind: input.kind },
      select: { id: true }
    });

    return usage.id;
  });
}

/**
 * Confirms a reservation in the transaction that saves the result. A
 * reservation older than the TTL stopped counting, so its credit may have gone
 * to someone else: the quota is checked again, under the lock, before keeping it.
 */
export async function commitArticleCredit(tx: Tx, usageId: string, now: Date = new Date()) {
  const usage = await tx.aiUsage.findUniqueOrThrow({
    where: { id: usageId },
    select: { workspaceId: true, kind: true, status: true, createdAt: true }
  });

  if (!countsTowardQuota(usage, now)) {
    await lockWorkspace(tx, usage.workspaceId);
    const { plan, limits } = await limitsInTx(tx, usage.workspaceId, now);

    if (limits && (await tx.aiUsage.count({ where: articleWhere(usage.workspaceId, now) })) >= limits.articlesPerMonth) {
      throw new QuotaError(noCreditMessage(plan, limits.articlesPerMonth));
    }
  }

  await tx.aiUsage.update({ where: { id: usageId }, data: { status: "COMMITTED" } });
}

export async function releaseArticleCredit(usageId: string) {
  try {
    await prisma.aiUsage.deleteMany({ where: { id: usageId, status: "PENDING" } });
  } catch (error) {
    // The reservation expires on its own; never hide the original failure.
    console.error("ai_credit_release_failed", { code: (error as { code?: string }).code ?? "unknown" });
  }
}

/**
 * Cheap read-only check for the auto-publisher, so a workspace with no credit
 * left skips the keyword-suggestion call too, which also costs AI tokens.
 */
export async function assertHasArticleCredit(workspaceId: string, now: Date = new Date()) {
  const { plan, limits } = await limitsInTx(prisma, workspaceId, now);

  if (limits && (await prisma.aiUsage.count({ where: articleWhere(workspaceId, now) })) >= limits.articlesPerMonth) {
    throw new QuotaError(noCreditMessage(plan, limits.articlesPerMonth));
  }
}

/**
 * Runs `fn` (a site create or transfer into this workspace) in the same
 * transaction as the site count, under the workspace lock.
 */
export async function withSiteSlot<T>(workspaceId: string, fn: (tx: Tx) => Promise<T>, now: Date = new Date()): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await lockWorkspace(tx, workspaceId);
    const { plan, limits } = await limitsInTx(tx, workspaceId, now);

    if (limits) {
      const sites = await tx.siteProject.count({ where: { workspaceId } });

      if (sites >= limits.sites) {
        throw new QuotaError(
          limits.sites === 0
            ? "Your trial has ended. Choose a plan at /billing to add sites."
            : `Your ${plan.toLowerCase()} plan includes ${limits.sites} site${limits.sites === 1 ? "" : "s"}. Upgrade at /billing to add more.`
        );
      }
    }

    return fn(tx);
  });
}

/** What the billing page shows: the plan in force, its limits and this month's use. */
export async function getUsageSummary(workspaceId: string, now: Date = new Date()) {
  const [workspace, sites, articles] = await Promise.all([
    prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { plan: true, trialEndsAt: true, stripeCustomerId: true, subscriptionStatus: true }
    }),
    prisma.siteProject.count({ where: { workspaceId } }),
    prisma.aiUsage.count({ where: articleWhere(workspaceId, now) })
  ]);
  const plan = effectivePlan(workspace, now);

  return { ...workspace, plan, limits: limitsFor(plan), sites, articles };
}
