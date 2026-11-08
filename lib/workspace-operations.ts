import { createUniqueArticleSlug } from "@/lib/article-slug";
import { listSearchConsolePropertiesForUser } from "@/lib/google-search-console";
import { renderMarkdownToHtml } from "@/lib/markdown";
import { prisma } from "@/lib/prisma";
import { withSiteSlot } from "@/lib/quota";
import { generatePublishingApiKey } from "@/lib/site-publishing-api";
import type {
  BrandDNAInput,
  CreateArticleInput,
  CreateSiteInput,
  UpdateArticleInput,
  UpdateAutoPublishSettingsInput,
  UpdateSearchLocaleDefaultsInput,
  UpdateTranslationSettingsInput
} from "@/lib/validations";
import { requireArticleInSite, requireSiteInWorkspace } from "@/lib/workspace-guards";
import { getMembership } from "@/lib/workspace-membership";
import { getOrCreateWorkspaceIdForUser } from "@/lib/workspace-provisioning";

/*
 * The protected half of each admin server action. Every function takes the
 * caller's workspaceId, checks the target belongs to it (throwing
 * Error("Not found") otherwise) and only then reads or writes.
 *
 * This module must never be "use server": its functions trust the workspaceId
 * argument, so they may only be called after requireWorkspace().
 */

export async function createSiteInWorkspace(workspaceId: string, data: CreateSiteInput) {
  return withSiteSlot(workspaceId, (tx) =>
    tx.siteProject.create({
      data: {
        workspaceId,
        name: data.name,
        domain: data.domain,
        brandProfile: { create: { contentLanguage: data.contentLanguage } }
      }
    })
  );
}

export const TRANSFER_OWNER_ONLY = "Only the workspace owner can transfer sites.";
export const TRANSFER_SAME_WORKSPACE = "That user is already in this workspace. Choose someone outside it.";

/**
 * Only the workspace OWNER may transfer, and never to someone in the same
 * workspace (the caller included). The caller's role is read again from the
 * database here, on top of the action's requireOwner(). Quota errors from the
 * target workspace propagate to the caller.
 */
export async function transferSiteInWorkspace(
  callerUserId: string,
  workspaceId: string,
  siteId: string,
  email: string
): Promise<{ error: string } | { siteName: string }> {
  const caller = await getMembership(callerUserId);

  if (!caller || caller.workspaceId !== workspaceId || caller.role !== "OWNER") {
    return { error: TRANSFER_OWNER_ONLY };
  }

  await requireSiteInWorkspace(siteId, workspaceId);
  const site = await prisma.siteProject.findUniqueOrThrow({ where: { id: siteId }, select: { id: true, name: true } });
  const targetUser = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true } });

  if (!targetUser) {
    return { error: "That user does not exist yet." };
  }

  if ((await getMembership(targetUser.id))?.workspaceId === workspaceId) {
    return { error: TRANSFER_SAME_WORKSPACE };
  }

  const targetWorkspaceId = await getOrCreateWorkspaceIdForUser(targetUser.id, targetUser.name, email);

  await withSiteSlot(targetWorkspaceId, (tx) =>
    tx.siteProject.update({ where: { id: site.id }, data: { workspaceId: targetWorkspaceId } })
  );

  return { siteName: site.name };
}

export async function deleteSiteInWorkspace(
  workspaceId: string,
  siteId: string,
  confirmName: string
): Promise<{ error: string } | { remainingSiteId: string | null }> {
  await requireSiteInWorkspace(siteId, workspaceId);
  const site = await prisma.siteProject.findUniqueOrThrow({ where: { id: siteId }, select: { id: true, name: true } });

  if (confirmName !== site.name) {
    return { error: "Site name does not match. Deletion cancelled." };
  }

  await prisma.siteProject.delete({ where: { id: site.id } });

  const remaining = await prisma.siteProject.findFirst({
    where: { workspaceId },
    orderBy: { createdAt: "asc" },
    select: { id: true }
  });

  return { remainingSiteId: remaining?.id ?? null };
}

export async function updateBrandDNAInWorkspace(workspaceId: string, siteId: string, data: BrandDNAInput) {
  await requireSiteInWorkspace(siteId, workspaceId);
  const existing = await prisma.brandProfile.findUnique({ where: { siteProjectId: siteId }, select: { id: true } });

  if (existing) {
    await prisma.brandProfile.update({ where: { siteProjectId: siteId }, data });
  } else {
    await prisma.brandProfile.create({ data: { siteProjectId: siteId, ...data } });
  }
}

export async function toggleArticleStatusInWorkspace(
  workspaceId: string,
  siteId: string,
  articleId: string,
  status: "DRAFT" | "PUBLISHED"
): Promise<{ slug: string }> {
  await requireArticleInSite(articleId, siteId, workspaceId);

  return prisma.article.update({
    where: { id: articleId },
    data: status === "PUBLISHED" ? { status: "PUBLISHED", publishedAt: new Date() } : { status: "DRAFT", publishedAt: null },
    select: { slug: true }
  });
}

export async function deleteArticleInWorkspace(
  workspaceId: string,
  siteId: string,
  articleId: string
): Promise<{ slug: string; status: "DRAFT" | "PUBLISHED" }> {
  await requireArticleInSite(articleId, siteId, workspaceId);

  return prisma.article.delete({ where: { id: articleId }, select: { slug: true, status: true } });
}

/** Throws Not found for a foreign site; any other error is a duplicate term. */
export async function createKeywordInWorkspace(workspaceId: string, siteId: string, term: string) {
  await requireSiteInWorkspace(siteId, workspaceId);
  await prisma.keyword.create({ data: { siteProjectId: siteId, term } });
}

export async function updateSearchConsolePropertyInWorkspace(
  workspaceId: string,
  userId: string,
  siteId: string,
  propertyUrl: string
): Promise<{ error?: string }> {
  await requireSiteInWorkspace(siteId, workspaceId);
  const site = await prisma.siteProject.findUniqueOrThrow({ where: { id: siteId }, select: { id: true, domain: true } });
  const properties = await listSearchConsolePropertiesForUser(userId, site.domain);

  if (!properties) {
    return { error: "Google Search Console is not connected." };
  }

  const selectedProperty = properties.find((property) => property.siteUrl === propertyUrl);

  if (!selectedProperty) {
    return { error: "Selected property is not available for this Google account." };
  }

  await prisma.siteProject.update({
    where: { id: site.id },
    data: { searchConsolePropertyUrl: selectedProperty.siteUrl, searchConsoleConnectedAt: new Date() }
  });

  return {};
}

export async function updateWidgetThemeInWorkspace(workspaceId: string, siteId: string, widgetTheme: "light" | "dark") {
  await requireSiteInWorkspace(siteId, workspaceId);
  await prisma.siteProject.update({ where: { id: siteId }, data: { widgetTheme } });
}

export async function updateAutoPublishSettingsInWorkspace(
  workspaceId: string,
  siteId: string,
  data: UpdateAutoPublishSettingsInput
) {
  await requireSiteInWorkspace(siteId, workspaceId);
  await prisma.siteProject.update({
    where: { id: siteId },
    data: {
      autoPublishEnabled: data.autoPublishEnabled,
      articlesPerWeek: data.articlesPerWeek,
      requireReview: data.requireReview
    }
  });
}

export async function updateSearchLocaleDefaultsInWorkspace(
  workspaceId: string,
  siteId: string,
  data: UpdateSearchLocaleDefaultsInput
) {
  await requireSiteInWorkspace(siteId, workspaceId);
  await prisma.siteProject.update({
    where: { id: siteId },
    data: { defaultSearchCountry: data.defaultSearchCountry, defaultSearchLanguage: data.defaultSearchLanguage }
  });
}

export async function updateTranslationSettingsInWorkspace(
  workspaceId: string,
  siteId: string,
  data: UpdateTranslationSettingsInput
): Promise<{ error?: string }> {
  await requireSiteInWorkspace(siteId, workspaceId);

  if (data.translationsEnabled && data.translationLanguages.length === 0) {
    return { error: "Select at least one target language when translations are enabled." };
  }

  await prisma.siteProject.update({
    where: { id: siteId },
    data: {
      translationsEnabled: data.translationsEnabled,
      translationLanguages: data.translationsEnabled ? data.translationLanguages : []
    }
  });

  return {};
}

export async function createPublishingApiKeyInWorkspace(workspaceId: string, siteId: string, label: string): Promise<string> {
  await requireSiteInWorkspace(siteId, workspaceId);
  const { rawKey, keyHash, keyPrefix } = generatePublishingApiKey();

  await prisma.sitePublishingApiKey.create({ data: { siteProjectId: siteId, label, keyHash, keyPrefix } });

  return rawKey;
}

export async function revokePublishingApiKeyInWorkspace(workspaceId: string, siteId: string, keyId: string) {
  await requireSiteInWorkspace(siteId, workspaceId);
  const apiKey = await prisma.sitePublishingApiKey.findFirst({
    where: { id: keyId, siteProjectId: siteId },
    select: { id: true, revokedAt: true }
  });

  if (!apiKey) {
    throw new Error("Not found");
  }

  if (!apiKey.revokedAt) {
    await prisma.sitePublishingApiKey.update({ where: { id: apiKey.id }, data: { revokedAt: new Date() } });
  }
}

export async function updateWidgetInstalledStateInWorkspace(workspaceId: string, siteId: string, installed: boolean) {
  await requireSiteInWorkspace(siteId, workspaceId);
  await prisma.siteProject.update({ where: { id: siteId }, data: { widgetInstalledAt: installed ? new Date() : null } });
}

/** Throws Not found for a foreign article; returns an error for a foreign or unknown keyword. */
export async function assignKeywordInWorkspace(
  workspaceId: string,
  siteId: string,
  articleId: string,
  keywordId: string | null
): Promise<{ error?: string }> {
  await requireArticleInSite(articleId, siteId, workspaceId);

  if (keywordId) {
    const keyword = await prisma.keyword.findFirst({
      where: { id: keywordId, siteProjectId: siteId, siteProject: { workspaceId } },
      select: { id: true }
    });

    if (!keyword) {
      return { error: "Keyword not found." };
    }
  }

  await prisma.article.update({ where: { id: articleId }, data: { keywordId } });

  if (keywordId) {
    await prisma.keyword.update({ where: { id: keywordId }, data: { status: "USED" } });
  }

  return {};
}

export async function createArticleInWorkspace(workspaceId: string, siteId: string, data: CreateArticleInput) {
  await requireSiteInWorkspace(siteId, workspaceId);
  const slug = await createUniqueArticleSlug(siteId, data.title);

  await prisma.article.create({
    data: {
      siteProjectId: siteId,
      title: data.title,
      slug,
      excerpt: data.excerpt,
      coverImageUrl: data.coverImageUrl,
      contentMarkdown: data.contentMarkdown,
      contentHtml: renderMarkdownToHtml(data.contentMarkdown),
      seoTitle: data.seoTitle,
      seoDescription: data.seoDescription,
      status: "DRAFT",
      publishedAt: data.publishedDate ? new Date(`${data.publishedDate}T00:00:00.000Z`) : null
    }
  });
}

export async function updateArticleInWorkspace(
  workspaceId: string,
  siteId: string,
  articleId: string,
  data: UpdateArticleInput
) {
  await requireArticleInSite(articleId, siteId, workspaceId);
  await prisma.article.update({
    where: { id: articleId },
    data: { ...data, contentHtml: renderMarkdownToHtml(data.contentMarkdown) }
  });
}

export async function updateArticleDateInWorkspace(
  workspaceId: string,
  siteId: string,
  articleId: string,
  newDate: string | null
): Promise<{ slug: string }> {
  await requireArticleInSite(articleId, siteId, workspaceId);

  return prisma.article.update({
    where: { id: articleId },
    data: { publishedAt: newDate ? new Date(newDate) : null },
    select: { slug: true }
  });
}
