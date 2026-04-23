"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { listSearchConsolePropertiesForUser } from "@/lib/google-search-console";
import { prisma } from "@/lib/prisma";
import {
  AssignKeywordSchema,
  CreateArticleInput,
  CreateArticleSchema,
  BrandDNAInput,
  CreateKeywordInput,
  CreateKeywordSchema,
  CreateSiteInput,
  CreateSiteSchema,
  ToggleArticleStatusSchema,
  UpdateSearchConsolePropertySchema,
  UpdateArticleDateSchema,
  UpdateArticleSchema,
  UpdateBrandDNASchema
} from "@/lib/validations";

export type ActionState = {
  error?: string;
  success?: string;
};

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

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 100);
}

async function createUniqueSlug(siteProjectId: string, title: string) {
  const baseSlug = slugify(title) || "article";
  let slug = baseSlug;
  let suffix = 2;

  while (true) {
    const existing = await prisma.article.findUnique({
      where: {
        siteProjectId_slug: {
          siteProjectId,
          slug
        }
      },
      select: { id: true }
    });

    if (!existing) {
      return slug;
    }

    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
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

async function getWorkspaceId() {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const existingWorkspace = await prisma.workspace.findUnique({
    where: { ownerId: session.user.id }
  });

  if (existingWorkspace) {
    return existingWorkspace.id;
  }

  const workspace = await prisma.workspace.create({
    data: {
      ownerId: session.user.id,
      name: session.user.name?.trim() ? `${session.user.name.trim()}'s Workspace` : "My Workspace"
    }
  });

  return workspace.id;
}

async function getCurrentUserId() {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  return session.user.id;
}

async function requireOwnedSite(siteId: string) {
  const userId = await getCurrentUserId();

  const site = await prisma.siteProject.findFirst({
    where: {
      id: siteId,
      workspace: {
        ownerId: userId
      }
    },
    select: { id: true, brandProfile: { select: { id: true } } }
  });

  if (!site) {
    throw new Error("Unauthorized");
  }

  return site;
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

  const workspaceId = await getWorkspaceId();

  const site = await prisma.$transaction(async (tx) => {
    return tx.siteProject.create({
      data: {
        workspaceId,
        name: parsed.data.name,
        domain: parsed.data.domain,
        brandProfile: {
          create: {
            contentLanguage: parsed.data.contentLanguage
          }
        }
      }
    });
  });

  revalidatePath("/settings");
  revalidatePath("/new-site");
  redirect(`/${site.id}`);
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

  let site;
  try {
    site = await requireOwnedSite(siteId);
  } catch {
    return { error: "Site not found." };
  }

  if (site.brandProfile) {
    await prisma.brandProfile.update({
      where: { siteProjectId: siteId },
      data: parsed.data
    });
  } else {
    await prisma.brandProfile.create({
      data: {
        siteProjectId: siteId,
        ...parsed.data
      }
    });
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

  const article = await prisma.article.findFirst({
    where: {
      id: parsed.data.articleId,
      siteProjectId: siteId,
      siteProject: {
        workspace: {
          ownerId: await getCurrentUserId()
        }
      }
    },
    select: { id: true, slug: true, siteProjectId: true }
  });

  if (!article) {
    return { error: "Article not found." };
  }

  await prisma.article.update({
    where: { id: article.id },
    data:
      parsed.data.status === "PUBLISHED"
        ? {
            status: "PUBLISHED",
            publishedAt: new Date()
          }
        : {
            status: "DRAFT",
            publishedAt: null
          }
  });

  revalidatePath(`/${siteId}/articles`);
  revalidatePath(`/api/public/sites/${siteId}/articles`);
  revalidatePath(`/api/public/sites/${siteId}/articles/${article.slug}`);

  return {
    success: parsed.data.status === "PUBLISHED" ? "Article published." : "Article unpublished."
  };
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

  try {
    await requireOwnedSite(siteId);
  } catch {
    return { error: "Site not found." };
  }

  try {
    await prisma.keyword.create({
      data: {
        siteProjectId: siteId,
        term: parsed.data.term
      }
    });
  } catch {
    return { error: "Keyword already exists for this site." };
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

  const userId = await getCurrentUserId();
  const site = await prisma.siteProject.findFirst({
    where: {
      id: siteId,
      workspace: {
        ownerId: userId
      }
    },
    select: {
      id: true,
      domain: true
    }
  });

  if (!site) {
    return { error: "Site not found." };
  }

  const properties = await listSearchConsolePropertiesForUser(userId, site.domain);

  if (!properties) {
    return { error: "Google Search Console is not connected." };
  }

  const selectedProperty = properties.find((property) => property.siteUrl === parsed.data.propertyUrl);

  if (!selectedProperty) {
    return { error: "Selected property is not available for this Google account." };
  }

  await prisma.siteProject.update({
    where: { id: site.id },
    data: {
      searchConsolePropertyUrl: selectedProperty.siteUrl,
      searchConsoleConnectedAt: new Date()
    }
  });

  revalidatePath(`/${siteId}/analytics`);

  return { success: "Search Console property connected." };
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

  const userId = await getCurrentUserId();
  const article = await prisma.article.findFirst({
    where: {
      id: parsed.data.articleId,
      siteProjectId: siteId,
      siteProject: {
        workspace: {
          ownerId: userId
        }
      }
    },
    select: { id: true, siteProjectId: true, keywordId: true }
  });

  if (!article) {
    return { error: "Article not found." };
  }

  if (parsed.data.keywordId) {
    const keyword = await prisma.keyword.findFirst({
      where: {
        id: parsed.data.keywordId,
        siteProjectId: siteId,
        siteProject: {
          workspace: {
            ownerId: userId
          }
        }
      },
      select: { id: true, siteProjectId: true }
    });

    if (!keyword) {
      return { error: "Keyword not found." };
    }
  }

  await prisma.article.update({
    where: { id: article.id },
    data: {
      keywordId: parsed.data.keywordId
    }
  });

  if (parsed.data.keywordId) {
    await prisma.keyword.update({
      where: { id: parsed.data.keywordId },
      data: { status: "USED" }
    });
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
    contentHtml: typeof formData.get("contentHtml") === "string" ? formData.get("contentHtml")!.toString() : "",
    seoTitle: cleanNullableText(formData.get("seoTitle")),
    seoDescription: cleanNullableText(formData.get("seoDescription")),
    publishedDate: typeof formData.get("publishedDate") === "string" ? formData.get("publishedDate")!.toString() : null,
    returnTo: typeof formData.get("returnTo") === "string" ? formData.get("returnTo")!.toString() : undefined
  };

  const parsed = CreateArticleSchema.safeParse(payload);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid article data." };
  }

  try {
    await requireOwnedSite(siteId);
  } catch {
    return { error: "Site not found." };
  }

  const slug = await createUniqueSlug(siteId, parsed.data.title);

  await prisma.article.create({
    data: {
      siteProjectId: siteId,
      title: parsed.data.title,
      slug,
      excerpt: parsed.data.excerpt,
      coverImageUrl: parsed.data.coverImageUrl,
      contentHtml: parsed.data.contentHtml,
      seoTitle: parsed.data.seoTitle,
      seoDescription: parsed.data.seoDescription,
      status: "DRAFT",
      publishedAt: parsed.data.publishedDate ? new Date(`${parsed.data.publishedDate}T00:00:00.000Z`) : null
    }
  });

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
    contentHtml: formData.get("contentHtml"),
    seoTitle: cleanNullableText(formData.get("seoTitle")),
    seoDescription: cleanNullableText(formData.get("seoDescription"))
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid article update." };
  }

  const article = await prisma.article.findFirst({
    where: {
      id: articleId,
      siteProjectId: siteId,
      siteProject: {
        workspace: {
          ownerId: await getCurrentUserId()
        }
      }
    },
    select: { id: true, siteProjectId: true }
  });

  if (!article) {
    return { error: "Article not found." };
  }

  await prisma.article.update({
    where: { id: article.id },
    data: parsed.data
  });

  revalidatePath(`/${siteId}/articles`);
  revalidatePath(`/${siteId}/articles/${articleId}`);
  revalidatePath(`/api/public/sites/${siteId}/articles`);

  return { success: "Article updated." };
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

  const article = await prisma.article.findFirst({
    where: {
      id: parsed.data.articleId,
      siteProjectId: siteId,
      siteProject: {
        workspace: {
          ownerId: await getCurrentUserId()
        }
      }
    },
    select: { id: true, siteProjectId: true, slug: true }
  });

  if (!article) {
    redirect(parsed.data.returnTo || fallbackReturnTo);
  }

  await prisma.article.update({
    where: { id: article.id },
    data: {
      publishedAt: parsed.data.newDate ? new Date(parsed.data.newDate) : null
    }
  });

  revalidatePath(`/${siteId}/calendar`);
  revalidatePath(`/${siteId}/articles`);
  revalidatePath(`/api/public/sites/${siteId}/articles`);
  revalidatePath(`/api/public/sites/${siteId}/articles/${article.slug}`);

  redirect(parsed.data.returnTo || fallbackReturnTo);
}
