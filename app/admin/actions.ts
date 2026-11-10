"use server";

import { revalidatePath } from "next/cache";

import { requireAdminAction } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

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
