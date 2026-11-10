"use server";

import { revalidatePath } from "next/cache";

import { requireAdminAction } from "@/lib/admin-auth";
import { applyPlanChange, type PlanAction, type PlanTx } from "@/lib/admin-plan-service";
import { prisma } from "@/lib/prisma";
import { lockWorkspace } from "@/lib/quota";
import { adminExtendTrialSchema, adminWorkspaceActionSchema } from "@/lib/validations";

export type AdminArticleToggleState = {
  error?: string;
  success?: string;
};

export async function adminToggleArticleStatus(
  _prevState: AdminArticleToggleState,
  formData: FormData
): Promise<AdminArticleToggleState> {
  await requireAdminAction();

  const articleId = formData.get("articleId")?.toString().trim();
  const nextStatus = formData.get("status")?.toString().trim();

  if (!articleId || (nextStatus !== "PUBLISHED" && nextStatus !== "DRAFT")) {
    return { error: "Invalid request." };
  }

  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: { id: true, slug: true, siteProjectId: true }
  });

  if (!article) {
    return { error: "Article not found." };
  }

  await prisma.article.update({
    where: { id: article.id },
    data: nextStatus === "PUBLISHED"
      ? { status: "PUBLISHED", publishedAt: new Date() }
      : { status: "DRAFT", publishedAt: null }
  });

  revalidatePath("/admin/content");
  revalidatePath(`/api/public/sites/${article.siteProjectId}/articles`);
  revalidatePath(`/api/public/sites/${article.siteProjectId}/articles/${article.slug}`);

  return { success: nextStatus === "PUBLISHED" ? "Published." : "Unpublished." };
}

export type AdminPlanActionState = {
  error?: string;
  success?: string;
};

async function runPlanAction(
  action: PlanAction,
  admin: { id: string; email: string },
  parsed: { workspaceId: string; userId: string; opId: string; days?: number }
): Promise<AdminPlanActionState> {
  const result = await prisma.$transaction((tx) => {
    const adapter: PlanTx = {
      lock: (workspaceId) => lockWorkspace(tx, workspaceId),
      findWorkspace: (workspaceId) =>
        tx.workspace.findUnique({
          where: { id: workspaceId },
          select: { plan: true, trialEndsAt: true, subscriptionStatus: true }
        }),
      updateWorkspace: async (workspaceId, data) => {
        await tx.workspace.update({ where: { id: workspaceId }, data });
      },
      findAudit: (opId) => tx.adminAuditLog.findUnique({ where: { opId }, select: { action: true, after: true } }),
      createAudit: async (row) => {
        await tx.adminAuditLog.create({ data: row });
      }
    };

    return applyPlanChange(adapter, {
      workspaceId: parsed.workspaceId,
      action,
      opId: parsed.opId,
      days: parsed.days,
      actor: admin,
      now: new Date()
    });
  });

  if (result.success) {
    revalidatePath("/admin");
    revalidatePath("/admin/users/" + parsed.userId);
  }

  return result;
}

export async function adminGrantComp(
  _prevState: AdminPlanActionState,
  formData: FormData
): Promise<AdminPlanActionState> {
  const admin = await requireAdminAction();
  const parsed = adminWorkspaceActionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid request." };
  return runPlanAction("GRANT_COMP", admin, parsed.data);
}

export async function adminRevokeComp(
  _prevState: AdminPlanActionState,
  formData: FormData
): Promise<AdminPlanActionState> {
  const admin = await requireAdminAction();
  const parsed = adminWorkspaceActionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid request." };
  return runPlanAction("REVOKE_COMP", admin, parsed.data);
}

export async function adminExtendTrial(
  _prevState: AdminPlanActionState,
  formData: FormData
): Promise<AdminPlanActionState> {
  const admin = await requireAdminAction();
  const parsed = adminExtendTrialSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid request." };
  return runPlanAction("EXTEND_TRIAL", admin, parsed.data);
}
