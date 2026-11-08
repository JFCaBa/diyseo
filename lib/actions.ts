"use server";

import { Prisma } from "@prisma/client";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { generateNextAutoArticleForSite as runAutoPublishGenerationForSite } from "@/lib/auto-publish";
import { prisma } from "@/lib/prisma";
import { createFixedWindowLimiter } from "@/lib/rate-limit";
import { commitArticleCredit, isQuotaError, releaseArticleCredit, reserveArticleCredit } from "@/lib/quota";
import { generateArticleTranslation as runArticleTranslation } from "@/lib/translate-article";
import { parseTranslationLanguagesFromFormData } from "@/lib/translations";
import {
  AssignKeywordSchema,
  CreateArticleInput,
  CreateArticleSchema,
  CreatePublishingApiKeySchema,
  BrandDNAInput,
  CreateKeywordInput,
  CreateKeywordSchema,
  DeleteArticleSchema,
  CreateSiteInput,
  CreateSiteSchema,
  DeleteSiteSchema,
  TransferSiteSchema,
  ToggleArticleStatusSchema,
  UpdateAutoPublishSettingsSchema,
  UpdateSearchLocaleDefaultsSchema,
  UpdateSearchConsolePropertySchema,
  UpdateTranslationSettingsSchema,
  UpdateWidgetThemeSchema,
  UpdateArticleDateSchema,
  UpdateArticleSchema,
  UpdateBrandDNASchema,
  GenerateArticleTranslationSchema,
  RevokePublishingApiKeySchema,
  parseWaitlistForm
} from "@/lib/validations";
import { requireWorkspace } from "@/lib/workspace-context";
import { isNotFoundError, requireArticleInSite, requireSiteInWorkspace } from "@/lib/workspace-guards";
import {
  assignKeywordInWorkspace,
  createArticleInWorkspace,
  createKeywordInWorkspace,
  createPublishingApiKeyInWorkspace,
  createSiteInWorkspace,
  deleteArticleInWorkspace,
  deleteSiteInWorkspace,
  revokePublishingApiKeyInWorkspace,
  toggleArticleStatusInWorkspace,
  transferSiteInWorkspace,
  updateArticleDateInWorkspace,
  updateArticleInWorkspace,
  updateAutoPublishSettingsInWorkspace,
  updateBrandDNAInWorkspace,
  updateSearchConsolePropertyInWorkspace,
  updateSearchLocaleDefaultsInWorkspace,
  updateTranslationSettingsInWorkspace,
  updateWidgetInstalledStateInWorkspace,
  updateWidgetThemeInWorkspace
} from "@/lib/workspace-operations";

export type ActionState = {
  error?: string;
  success?: string;
  apiKeySecret?: string;
  generatedArticle?: {
    id: string;
    title: string;
    slug: string;
    status: "DRAFT" | "PUBLISHED";
  };
};

function normalizeActionErrorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;

  if (
    message === "GEMINI_API_KEY is not configured." ||
    message === "DEEPSEEK_API_KEY is not configured." ||
    message.startsWith("Unsupported AI provider:")
  ) {
    return "AI provider is not configured.";
  }

  return message;
}

function cleanOptionalText(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeBrandListText(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
    .join("\n");

  return normalized.length > 0 ? normalized : undefined;
}

function normalizeImageStyle(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value
    .trim()
    .replace(/\s+/g, " ");

  return normalized.length > 0 ? normalized : undefined;
}

function cleanNullableText(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toUtcIsoFromDateInput(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const candidate = new Date(`${trimmed}T00:00:00.000Z`);

  if (Number.isNaN(candidate.getTime())) {
    return null;
  }

  return candidate.toISOString();
}

/**
 * Runs a workspace operation and maps its Error("Not found") to the action's
 * user-facing message. Any other error propagates.
 */
async function orNotFound<T>(operation: Promise<T>, message: string): Promise<T | { error: string }> {
  try {
    return await operation;
  } catch (error) {
    if (isNotFoundError(error)) {
      return { error: message };
    }

    throw error;
  }
}

function failed(result: unknown): result is { error: string } {
  return typeof result === "object" && result !== null && typeof (result as { error?: unknown }).error === "string";
}

export async function createSite(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const payload: CreateSiteInput = {
    name: typeof formData.get("name") === "string" ? formData.get("name")!.toString().trim() : "",
    domain: typeof formData.get("domain") === "string" ? formData.get("domain")!.toString().trim() : "",
    contentLanguage:
      typeof formData.get("contentLanguage") === "string" ? formData.get("contentLanguage")!.toString().trim() : "en"
  };

  const parsed = CreateSiteSchema.safeParse(payload);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid site data." };
  }

  const { workspaceId } = await requireWorkspace();

  let site;

  try {
    site = await createSiteInWorkspace(workspaceId, parsed.data);
  } catch (error) {
    if (isQuotaError(error)) {
      return { error: error.message };
    }

    throw error;
  }

  revalidatePath("/settings");
  revalidatePath("/new-site");
  redirect(`/${site.id}`);
}

export async function transferSite(
  siteId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = TransferSiteSchema.safeParse({
    email: typeof formData.get("email") === "string" ? formData.get("email")!.toString().trim().toLowerCase() : ""
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid transfer target." };
  }

  const { workspaceId } = await requireWorkspace();
  let result;

  try {
    result = await orNotFound(transferSiteInWorkspace(workspaceId, siteId, parsed.data.email), "Site not found.");
  } catch (error) {
    if (isQuotaError(error)) {
      return { error: "The other account has no free site slot on its plan." };
    }

    throw error;
  }

  if (failed(result)) {
    return { error: result.error };
  }

  revalidatePath("/settings");
  revalidatePath(`/${siteId}`);
  revalidatePath(`/${siteId}/brand-dna`);
  revalidatePath(`/${siteId}/articles`);
  revalidatePath(`/${siteId}/analytics`);
  revalidatePath(`/${siteId}/keywords`);
  revalidatePath(`/${siteId}/calendar`);

  return { success: `Transferred ${result.siteName} to ${parsed.data.email}. Refresh to update your site list.` };
}

export async function deleteSite(
  siteId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = DeleteSiteSchema.safeParse({
    confirmName: typeof formData.get("confirmName") === "string" ? formData.get("confirmName")!.toString().trim() : ""
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid site deletion confirmation." };
  }

  const { workspaceId } = await requireWorkspace();
  const result = await orNotFound(deleteSiteInWorkspace(workspaceId, siteId, parsed.data.confirmName), "Site not found.");

  if (failed(result)) {
    return { error: result.error };
  }

  revalidatePath("/settings");
  revalidatePath(`/${siteId}`);
  revalidatePath(`/${siteId}/settings`);
  revalidatePath(`/${siteId}/brand-dna`);
  revalidatePath(`/${siteId}/articles`);
  revalidatePath(`/${siteId}/analytics`);
  revalidatePath(`/${siteId}/keywords`);
  revalidatePath(`/${siteId}/calendar`);

  redirect(result.remainingSiteId ? `/${result.remainingSiteId}/settings` : "/new-site");
}

export async function updateBrandDNA(
  siteId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const payload: BrandDNAInput = {
    contentLanguage: cleanOptionalText(formData.get("contentLanguage")),
    businessType: cleanOptionalText(formData.get("businessType")),
    brandVoiceTone: cleanOptionalText(formData.get("brandVoiceTone")),
    targetAudience: cleanOptionalText(formData.get("targetAudience")),
    serviceArea: cleanOptionalText(formData.get("serviceArea")),
    topicsToAvoid: normalizeBrandListText(formData.get("topicsToAvoid")),
    keyThemes: normalizeBrandListText(formData.get("keyThemes")),
    customImageInstructions: cleanOptionalText(formData.get("customImageInstructions")),
    imageStyle: normalizeImageStyle(formData.get("imageStyle"))
  };

  const parsed = UpdateBrandDNASchema.safeParse(payload);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid Brand DNA data." };
  }

  const { workspaceId } = await requireWorkspace();
  const result = await orNotFound(updateBrandDNAInWorkspace(workspaceId, siteId, parsed.data), "Site not found.");

  if (failed(result)) {
    return { error: result.error };
  }

  revalidatePath(`/${siteId}/brand-dna`);
  revalidatePath(`/${siteId}`);

  return { success: "Brand DNA updated." };
}

export async function toggleArticleStatus(
  siteId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = ToggleArticleStatusSchema.safeParse({
    articleId: formData.get("articleId"),
    status: formData.get("status")
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid article status update." };
  }

  const { workspaceId } = await requireWorkspace();
  const article = await orNotFound(
    toggleArticleStatusInWorkspace(workspaceId, siteId, parsed.data.articleId, parsed.data.status),
    "Article not found."
  );

  if (failed(article)) {
    return { error: article.error };
  }

  revalidatePath(`/${siteId}/articles`);
  revalidatePath(`/api/public/sites/${siteId}/articles`);
  revalidatePath(`/api/public/sites/${siteId}/articles/${article.slug}`);

  return {
    success: parsed.data.status === "PUBLISHED" ? "Article published." : "Article unpublished."
  };
}

export async function deleteArticle(
  siteId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = DeleteArticleSchema.safeParse({
    articleId: formData.get("articleId")
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid article delete request." };
  }

  const { workspaceId } = await requireWorkspace();
  const article = await orNotFound(deleteArticleInWorkspace(workspaceId, siteId, parsed.data.articleId), "Article not found.");

  if (failed(article)) {
    return { error: article.error };
  }

  revalidatePath(`/${siteId}/articles`);
  revalidatePath(`/${siteId}/calendar`);
  revalidatePath(`/${siteId}/preview`);
  revalidatePath(`/api/public/sites/${siteId}/articles`);
  revalidatePath(`/api/public/sites/${siteId}/articles/${article.slug}`);

  if (article.status === "PUBLISHED") {
    revalidatePath(`/blog/${siteId}`);
    revalidatePath(`/blog/${siteId}/${article.slug}`);
  }

  return { success: "Article deleted." };
}

export async function createKeyword(
  siteId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const payload: CreateKeywordInput = {
    term: typeof formData.get("term") === "string" ? formData.get("term")!.toString().trim() : ""
  };

  const parsed = CreateKeywordSchema.safeParse(payload);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid keyword term." };
  }

  const { workspaceId } = await requireWorkspace();

  try {
    await createKeywordInWorkspace(workspaceId, siteId, parsed.data.term);
  } catch (error) {
    return { error: isNotFoundError(error) ? "Site not found." : "Keyword already exists for this site." };
  }

  revalidatePath(`/${siteId}/keywords`);
  revalidatePath(`/${siteId}/articles`);

  return { success: "Keyword created." };
}

export async function updateSearchConsoleProperty(
  siteId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = UpdateSearchConsolePropertySchema.safeParse({
    propertyUrl: formData.get("propertyUrl")
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid Search Console property." };
  }

  const { workspaceId, userId } = await requireWorkspace();
  const result = await orNotFound(
    updateSearchConsolePropertyInWorkspace(workspaceId, userId, siteId, parsed.data.propertyUrl),
    "Site not found."
  );

  if (failed(result)) {
    return { error: result.error };
  }

  revalidatePath(`/${siteId}/analytics`);

  return { success: "Search Console property connected." };
}

export async function updateWidgetTheme(
  siteId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = UpdateWidgetThemeSchema.safeParse({
    widgetTheme: formData.get("widgetTheme")
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid widget theme." };
  }

  const { workspaceId } = await requireWorkspace();
  const result = await orNotFound(updateWidgetThemeInWorkspace(workspaceId, siteId, parsed.data.widgetTheme), "Site not found.");

  if (failed(result)) {
    return { error: result.error };
  }

  revalidatePath(`/${siteId}`);

  return { success: "Widget theme updated." };
}

export async function updateAutoPublishSettings(
  siteId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = UpdateAutoPublishSettingsSchema.safeParse({
    autoPublishEnabled: formData.get("autoPublishEnabled") === "true",
    articlesPerWeek: formData.get("articlesPerWeek"),
    requireReview: formData.get("requireReview") === "true"
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid auto-publish settings." };
  }

  const { workspaceId } = await requireWorkspace();
  const result = await orNotFound(updateAutoPublishSettingsInWorkspace(workspaceId, siteId, parsed.data), "Site not found.");

  if (failed(result)) {
    return { error: result.error };
  }

  revalidatePath(`/${siteId}`);
  revalidatePath(`/${siteId}/settings`);

  return { success: "Auto-publish settings updated." };
}

export async function updateSearchLocaleDefaults(
  siteId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = UpdateSearchLocaleDefaultsSchema.safeParse({
    defaultSearchCountry: formData.get("defaultSearchCountry"),
    defaultSearchLanguage: formData.get("defaultSearchLanguage")
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid search locale defaults." };
  }

  const { workspaceId } = await requireWorkspace();
  const result = await orNotFound(updateSearchLocaleDefaultsInWorkspace(workspaceId, siteId, parsed.data), "Site not found.");

  if (failed(result)) {
    return { error: result.error };
  }

  revalidatePath(`/${siteId}/settings`);
  revalidatePath(`/${siteId}/analytics`);

  return { success: "Search locale defaults updated." };
}

export async function updateTranslationSettings(
  siteId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const translationsEnabled = formData.get("translationsEnabled") === "true";
  const translationLanguages = parseTranslationLanguagesFromFormData(formData.getAll("translationLanguages"));
  const parsed = UpdateTranslationSettingsSchema.safeParse({
    translationsEnabled,
    translationLanguages
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid translation settings." };
  }

  const { workspaceId } = await requireWorkspace();
  const result = await orNotFound(updateTranslationSettingsInWorkspace(workspaceId, siteId, parsed.data), "Site not found.");

  if (failed(result)) {
    return { error: result.error };
  }

  revalidatePath(`/${siteId}/settings`);
  revalidatePath(`/${siteId}/articles`);

  return { success: "Translation settings updated." };
}

export async function createPublishingApiKey(
  siteId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = CreatePublishingApiKeySchema.safeParse({
    label: formData.get("label")
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid API key label." };
  }

  const { workspaceId } = await requireWorkspace();
  const rawKey = await orNotFound(createPublishingApiKeyInWorkspace(workspaceId, siteId, parsed.data.label), "Site not found.");

  if (failed(rawKey)) {
    return { error: rawKey.error };
  }

  revalidatePath(`/${siteId}/settings`);

  return {
    success: "Publishing API key created. Store it now because it will not be shown again.",
    apiKeySecret: rawKey
  };
}

export async function revokePublishingApiKey(
  siteId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = RevokePublishingApiKeySchema.safeParse({
    keyId: formData.get("keyId")
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid API key." };
  }

  const { workspaceId } = await requireWorkspace();
  const result = await orNotFound(revokePublishingApiKeyInWorkspace(workspaceId, siteId, parsed.data.keyId), "API key not found.");

  if (failed(result)) {
    return { error: result.error };
  }

  revalidatePath(`/${siteId}/settings`);

  return { success: "Publishing API key revoked." };
}

export async function updateWidgetInstalledState(
  siteId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const markInstalled = formData.get("installed") === "true";

  const { workspaceId } = await requireWorkspace();
  const result = await orNotFound(updateWidgetInstalledStateInWorkspace(workspaceId, siteId, markInstalled), "Site not found.");

  if (failed(result)) {
    return { error: result.error };
  }

  revalidatePath(`/${siteId}`);

  return { success: markInstalled ? "Widget marked as installed." : "Widget marked as not installed." };
}

export async function generateNextAutoArticle(
  siteId: string,
  _prevState: ActionState,
  _formData: FormData
): Promise<ActionState> {
  const { workspaceId } = await requireWorkspace();
  const site = await orNotFound(requireSiteInWorkspace(siteId, workspaceId), "Site not found.");

  if (failed(site)) {
    return { error: site.error };
  }

  try {
    const result = await runAutoPublishGenerationForSite(siteId);

    revalidatePath(`/${siteId}`);
    revalidatePath(`/${siteId}/settings`);
    revalidatePath(`/${siteId}/articles`);
    revalidatePath(`/${siteId}/keywords`);
    revalidatePath(`/${siteId}/calendar`);
    revalidatePath(`/blog/${siteId}`);
    revalidatePath(`/blog/${siteId}/${result.article.slug}`);
    revalidatePath(`/api/public/sites/${siteId}/articles`);
    revalidatePath(`/api/public/sites/${siteId}/articles/${result.article.slug}`);

    return {
      success: `Generated ${result.article.status === "PUBLISHED" ? "and published" : "as a draft"} from keyword "${result.selectedKeyword.term}".`,
      generatedArticle: result.article
    };
  } catch (error) {
    return {
      error: normalizeActionErrorMessage(error, "Auto article generation failed.")
    };
  }
}

export async function assignKeywordToArticle(
  siteId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = AssignKeywordSchema.safeParse({
    articleId: formData.get("articleId"),
    keywordId: formData.get("keywordId")
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid keyword assignment." };
  }

  const { workspaceId } = await requireWorkspace();
  const result = await orNotFound(
    assignKeywordInWorkspace(workspaceId, siteId, parsed.data.articleId, parsed.data.keywordId),
    "Article not found."
  );

  if (failed(result)) {
    return { error: result.error };
  }

  revalidatePath(`/${siteId}/articles`);
  revalidatePath(`/${siteId}/keywords`);

  return { success: parsed.data.keywordId ? "Keyword assigned." : "Keyword cleared." };
}

export async function createArticle(
  siteId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const payload: CreateArticleInput = {
    title: typeof formData.get("title") === "string" ? formData.get("title")!.toString().trim() : "",
    excerpt: cleanNullableText(formData.get("excerpt")),
    coverImageUrl: cleanNullableText(formData.get("coverImageUrl")),
    contentMarkdown: typeof formData.get("contentMarkdown") === "string" ? formData.get("contentMarkdown")!.toString() : "",
    seoTitle: cleanNullableText(formData.get("seoTitle")),
    seoDescription: cleanNullableText(formData.get("seoDescription")),
    publishedDate: typeof formData.get("publishedDate") === "string" ? formData.get("publishedDate")!.toString() : null,
    returnTo: typeof formData.get("returnTo") === "string" ? formData.get("returnTo")!.toString() : undefined
  };

  const parsed = CreateArticleSchema.safeParse(payload);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid article data." };
  }

  const { workspaceId } = await requireWorkspace();
  const result = await orNotFound(createArticleInWorkspace(workspaceId, siteId, parsed.data), "Site not found.");

  if (failed(result)) {
    return { error: result.error };
  }

  revalidatePath(`/${siteId}/articles`);
  revalidatePath(`/${siteId}/calendar`);

  redirect(parsed.data.returnTo || `/${siteId}/calendar`);
}

export async function updateArticle(
  siteId: string,
  articleId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = UpdateArticleSchema.safeParse({
    title: formData.get("title"),
    excerpt: cleanNullableText(formData.get("excerpt")),
    coverImageUrl: cleanNullableText(formData.get("coverImageUrl")),
    contentMarkdown: formData.get("contentMarkdown"),
    seoTitle: cleanNullableText(formData.get("seoTitle")),
    seoDescription: cleanNullableText(formData.get("seoDescription"))
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid article update." };
  }

  const { workspaceId } = await requireWorkspace();
  const result = await orNotFound(updateArticleInWorkspace(workspaceId, siteId, articleId, parsed.data), "Article not found.");

  if (failed(result)) {
    return { error: result.error };
  }

  revalidatePath(`/${siteId}/articles`);
  revalidatePath(`/${siteId}/articles/${articleId}`);
  revalidatePath(`/api/public/sites/${siteId}/articles`);

  return { success: "Article updated." };
}

export async function generateArticleTranslation(
  siteId: string,
  articleId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = GenerateArticleTranslationSchema.safeParse({
    articleId,
    language: formData.get("language")
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid translation request." };
  }

  const { workspaceId } = await requireWorkspace();
  const guarded = await orNotFound(requireArticleInSite(parsed.data.articleId, siteId, workspaceId), "Article not found.");

  if (failed(guarded)) {
    return { error: guarded.error };
  }

  const article = await prisma.article.findUnique({
    where: { id: guarded.id },
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      contentMarkdown: true,
      seoTitle: true,
      seoDescription: true,
      siteProject: {
        select: {
          workspaceId: true,
          translationsEnabled: true,
          translationLanguages: true
        }
      }
    }
  });

  if (!article) {
    return { error: "Article not found." };
  }

  if (!article.siteProject.translationsEnabled) {
    return { error: "Translations are disabled for this site." };
  }

  if (!article.siteProject.translationLanguages.includes(parsed.data.language)) {
    return { error: "This language is not enabled for the site." };
  }

  if (!article.contentMarkdown?.trim()) {
    return { error: "Resave this article in Markdown before generating translations." };
  }

  let usageId: string;

  try {
    usageId = await reserveArticleCredit({ workspaceId: article.siteProject.workspaceId, siteProjectId: siteId, kind: "TRANSLATION" });
  } catch (error) {
    if (isQuotaError(error)) {
      return { error: error.message };
    }

    throw error;
  }

  try {
    const translated = await runArticleTranslation({
      title: article.title,
      excerpt: article.excerpt,
      seoTitle: article.seoTitle,
      seoDescription: article.seoDescription,
      contentMarkdown: article.contentMarkdown,
      language: parsed.data.language
    });

    await prisma.$transaction(async (tx) => {
      await commitArticleCredit(tx, usageId);
      await tx.articleTranslation.upsert({
        where: {
          articleId_language: {
            articleId: article.id,
            language: parsed.data.language
          }
        },
        update: {
          title: translated.title,
          excerpt: translated.excerpt ?? null,
          contentMarkdown: translated.contentMarkdown,
          seoTitle: translated.seoTitle,
          seoDescription: translated.seoDescription
        },
        create: {
          articleId: article.id,
          language: parsed.data.language,
          title: translated.title,
          excerpt: translated.excerpt ?? null,
          contentMarkdown: translated.contentMarkdown,
          seoTitle: translated.seoTitle,
          seoDescription: translated.seoDescription
        }
      });
    });

    revalidatePath(`/${siteId}/articles/${articleId}`);
    revalidatePath(`/${siteId}/preview`);
    revalidatePath(`/blog/${siteId}/${article.slug}`);
    revalidatePath(`/api/public/sites/${siteId}/articles/${article.slug}`);

    return { success: "Translation generated." };
  } catch (error) {
    await releaseArticleCredit(usageId);

    return {
      error: normalizeActionErrorMessage(error, "Article translation failed.")
    };
  }
}

export async function updateArticleDate(siteId: string, formData: FormData) {
  const fallbackReturnTo =
    typeof formData.get("returnTo") === "string" ? formData.get("returnTo")!.toString() : `/${siteId}/calendar`;
  const parsed = UpdateArticleDateSchema.safeParse({
    articleId: formData.get("articleId"),
    newDate: toUtcIsoFromDateInput(formData.get("newDate")),
    returnTo: fallbackReturnTo
  });

  if (!parsed.success) {
    redirect(fallbackReturnTo);
  }

  const { workspaceId } = await requireWorkspace();
  const article = await orNotFound(
    updateArticleDateInWorkspace(workspaceId, siteId, parsed.data.articleId, parsed.data.newDate),
    "Article not found."
  );

  if (failed(article)) {
    redirect(parsed.data.returnTo || fallbackReturnTo);
  }

  revalidatePath(`/${siteId}/calendar`);
  revalidatePath(`/${siteId}/articles`);
  revalidatePath(`/api/public/sites/${siteId}/articles`);
  revalidatePath(`/api/public/sites/${siteId}/articles/${article.slug}`);

  redirect(parsed.data.returnTo || fallbackReturnTo);
}

export type WaitlistState = { status: "idle" | "success" | "error"; message?: string };

const WAITLIST_WINDOW_MS = 60 * 60 * 1000;
const allowWaitlistRequestFromIp = createFixedWindowLimiter({ limit: 10, windowMs: WAITLIST_WINDOW_MS });
// IP headers can be forged if the origin is reached directly. This per-process cap limits inserts regardless.
const allowWaitlistRequest = createFixedWindowLimiter({ limit: 300, windowMs: WAITLIST_WINDOW_MS });

async function getRequestIp() {
  const requestHeaders = await headers();

  return requestHeaders.get("cf-connecting-ip") ?? requestHeaders.get("x-real-ip") ?? "unknown";
}

export async function joinWaitlist(_previous: WaitlistState, formData: FormData): Promise<WaitlistState> {
  const submission = parseWaitlistForm(formData);

  if (submission.kind === "bot") {
    return { status: "success" };
  }

  if (submission.kind === "invalid") {
    return { status: "error", message: "Check your email address." };
  }

  if (!allowWaitlistRequestFromIp(await getRequestIp()) || !allowWaitlistRequest("all")) {
    return { status: "error", message: "Too many attempts. Please try again later." };
  }

  const { email, plan } = submission;

  try {
    await prisma.waitlistEntry.upsert({
      where: { email },
      create: { email, plan },
      update: plan ? { plan } : {}
    });
  } catch (error) {
    // P2002 is a concurrent signup for the same email. Anything else is logged by code only: Prisma's
    // messages can quote the query arguments, and those include the email.
    const code = error instanceof Prisma.PrismaClientKnownRequestError ? error.code : "unknown";

    if (code !== "P2002") {
      console.error("waitlist_signup_failed", { code });
      return { status: "error", message: "We couldn't add you. Please try again." };
    }
  }

  return { status: "success" };
}
