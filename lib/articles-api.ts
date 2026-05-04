import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { buildAdminArticleUrl, buildPublicArticleUrl } from "@/lib/app-origin";
import { generateAndSaveArticleCoverImage } from "@/lib/generate-cover-image";
import { renderMarkdownToHtml } from "@/lib/markdown";
import { prisma } from "@/lib/prisma";
import { extractPublishingApiKey, findActivePublishingApiKeyForSite } from "@/lib/site-publishing-api";
import {
  ListArticlesApiQuerySchema,
  PatchArticleApiPayloadSchema,
  PutArticleApiPayloadSchema
} from "@/lib/validations";

const MAX_UPDATE_PAYLOAD_CHARS = 200_000;

type AuthorizedSite = {
  apiKeyId: string;
};

const articleSelect = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  coverImageUrl: true,
  seoTitle: true,
  seoDescription: true,
  status: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true
} as const;

const articleSelectWithContent = {
  ...articleSelect,
  contentMarkdown: true,
  contentHtml: true
} as const;

type ArticleRow = Awaited<ReturnType<typeof prisma.article.findFirstOrThrow>>;
type ArticleSummary = Pick<ArticleRow, keyof typeof articleSelect>;
type ArticleWithContent = ArticleSummary & Pick<ArticleRow, "contentMarkdown" | "contentHtml">;

async function authorize(request: Request, siteId: string): Promise<AuthorizedSite | NextResponse> {
  const rawKey = extractPublishingApiKey(request);

  if (!rawKey) {
    return NextResponse.json({ error: "Missing publishing API key." }, { status: 401 });
  }

  const apiKey = await findActivePublishingApiKeyForSite(siteId, rawKey);

  if (!apiKey) {
    return NextResponse.json({ error: "Invalid or revoked publishing API key." }, { status: 401 });
  }

  return { apiKeyId: apiKey.id };
}

async function touchApiKey(apiKeyId: string) {
  await prisma.sitePublishingApiKey.update({
    where: { id: apiKeyId },
    data: { lastUsedAt: new Date() }
  });
}

function serializeArticle(siteId: string, article: ArticleSummary | ArticleWithContent) {
  const base = {
    id: article.id,
    title: article.title,
    slug: article.slug,
    excerpt: article.excerpt,
    coverImageUrl: article.coverImageUrl,
    seoTitle: article.seoTitle,
    seoDescription: article.seoDescription,
    status: article.status,
    publishedAt: article.publishedAt,
    createdAt: article.createdAt,
    updatedAt: article.updatedAt,
    publicUrl: article.status === "PUBLISHED" ? buildPublicArticleUrl(siteId, article.slug) : null,
    editorUrl: buildAdminArticleUrl(siteId, article.id)
  };

  if ("contentMarkdown" in article) {
    return {
      ...base,
      contentMarkdown: article.contentMarkdown,
      contentHtml: article.contentHtml
    };
  }

  return base;
}

function encodeCursor(article: { createdAt: Date; id: string }) {
  return Buffer.from(`${article.createdAt.toISOString()}|${article.id}`, "utf8").toString("base64url");
}

function decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const [iso, id] = decoded.split("|", 2);
    if (!iso || !id) return null;
    const createdAt = new Date(iso);
    if (Number.isNaN(createdAt.getTime())) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

function revalidateForSite(siteId: string, slug: string, status: "DRAFT" | "PUBLISHED", articleId: string) {
  revalidatePath(`/${siteId}/articles`);
  revalidatePath(`/${siteId}/articles/${articleId}`);
  revalidatePath(`/${siteId}/calendar`);
  revalidatePath(`/api/public/sites/${siteId}/articles`);

  if (status === "PUBLISHED") {
    revalidatePath(`/blog/${siteId}`);
    revalidatePath(`/blog/${siteId}/${slug}`);
    revalidatePath(`/api/public/sites/${siteId}/articles/${slug}`);
  }
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function handleUnknownError(error: unknown, fallback: string) {
  if (error instanceof SyntaxError) {
    return jsonError("Invalid JSON body.", 400);
  }

  if (error instanceof ZodError) {
    return jsonError(error.issues[0]?.message ?? fallback, 400);
  }

  const message = error instanceof Error ? error.message : fallback;
  return jsonError(message, 500);
}

export async function handleListArticlesRequest(request: Request, siteId: string) {
  try {
    const auth = await authorize(request, siteId);
    if (auth instanceof NextResponse) return auth;

    const url = new URL(request.url);
    const query = ListArticlesApiQuerySchema.parse({
      status: url.searchParams.get("status") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
      cursor: url.searchParams.get("cursor") ?? undefined,
      include: url.searchParams.get("include") ?? undefined
    });

    const includeContent = query.include.includes("content");
    const cursor = query.cursor ? decodeCursor(query.cursor) : null;

    if (query.cursor && !cursor) {
      return jsonError("Invalid cursor.", 400);
    }

    const where = {
      siteProjectId: siteId,
      ...(query.status ? { status: query.status } : {}),
      ...(cursor
        ? {
            OR: [
              { createdAt: { lt: cursor.createdAt } },
              { createdAt: cursor.createdAt, id: { lt: cursor.id } }
            ]
          }
        : {})
    };

    const rows = await prisma.article.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
      select: includeContent ? articleSelectWithContent : articleSelect
    });

    await touchApiKey(auth.apiKeyId);

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    const nextCursor = hasMore ? encodeCursor(page[page.length - 1]) : null;

    return NextResponse.json({
      siteId,
      articles: page.map((article) => serializeArticle(siteId, article)),
      nextCursor
    });
  } catch (error) {
    return handleUnknownError(error, "Failed to list articles.");
  }
}

async function findArticleByIdOrSlug(siteId: string, idOrSlug: string) {
  return prisma.article.findFirst({
    where: {
      siteProjectId: siteId,
      OR: [{ id: idOrSlug }, { slug: idOrSlug }]
    },
    select: articleSelectWithContent
  });
}

export async function handleGetArticleRequest(request: Request, siteId: string, idOrSlug: string) {
  try {
    const auth = await authorize(request, siteId);
    if (auth instanceof NextResponse) return auth;

    const article = await findArticleByIdOrSlug(siteId, idOrSlug);

    if (!article) {
      return jsonError("Article not found.", 404);
    }

    await touchApiKey(auth.apiKeyId);

    return NextResponse.json({
      siteId,
      article: serializeArticle(siteId, article)
    });
  } catch (error) {
    return handleUnknownError(error, "Failed to fetch article.");
  }
}

type UpdateBody = {
  title?: string;
  excerpt?: string | null;
  coverImageUrl?: string | null;
  contentMarkdown?: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  status?: "DRAFT" | "PUBLISHED";
  publishedAt?: string | null;
  generateCoverImage?: boolean;
};

async function applyArticleUpdate(
  siteId: string,
  idOrSlug: string,
  body: UpdateBody,
  options: { mode: "patch" | "put" }
) {
  const existing = await prisma.article.findFirst({
    where: {
      siteProjectId: siteId,
      OR: [{ id: idOrSlug }, { slug: idOrSlug }]
    },
    select: { id: true, status: true, publishedAt: true, slug: true }
  });

  if (!existing) {
    return { error: jsonError("Article not found.", 404) };
  }

  const data: Record<string, unknown> = {};

  if (options.mode === "put" || body.title !== undefined) {
    data.title = body.title;
  }
  if (options.mode === "put" || body.excerpt !== undefined) {
    data.excerpt = body.excerpt ?? null;
  }
  if (options.mode === "put" || body.coverImageUrl !== undefined) {
    data.coverImageUrl = body.coverImageUrl ?? null;
  }
  if (options.mode === "put" || body.contentMarkdown !== undefined) {
    data.contentMarkdown = body.contentMarkdown;
    data.contentHtml = renderMarkdownToHtml(body.contentMarkdown ?? "");
  }
  if (options.mode === "put" || body.seoTitle !== undefined) {
    data.seoTitle = body.seoTitle ?? null;
  }
  if (options.mode === "put" || body.seoDescription !== undefined) {
    data.seoDescription = body.seoDescription ?? null;
  }

  const targetStatus = body.status ?? (options.mode === "put" ? "DRAFT" : existing.status);
  const statusChanged = options.mode === "put" || (body.status !== undefined && body.status !== existing.status);

  if (options.mode === "put" || body.status !== undefined) {
    data.status = targetStatus;
  }

  if (body.publishedAt !== undefined) {
    data.publishedAt = body.publishedAt ? new Date(body.publishedAt) : null;
  } else if (statusChanged) {
    if (targetStatus === "PUBLISHED" && !existing.publishedAt) {
      data.publishedAt = new Date();
    } else if (targetStatus === "DRAFT") {
      data.publishedAt = null;
    }
  }

  const updated = await prisma.article.update({
    where: { id: existing.id },
    data,
    select: articleSelectWithContent
  });

  revalidateForSite(siteId, updated.slug, updated.status, updated.id);

  if (existing.slug !== updated.slug || existing.status !== updated.status) {
    revalidateForSite(siteId, existing.slug, existing.status, existing.id);
  }

  if (body.generateCoverImage) {
    void generateAndSaveArticleCoverImage({ siteId, articleId: updated.id })
      .then(() => {
        revalidateForSite(siteId, updated.slug, updated.status, updated.id);
      })
      .catch((error) => {
        console.error(
          `articles-api: cover image generation failed for article ${updated.id}:`,
          error instanceof Error ? error.message : error
        );
      });
  }

  return { article: updated };
}

async function readJsonBody(request: Request) {
  const rawBody = await request.text();

  if (rawBody.length > MAX_UPDATE_PAYLOAD_CHARS) {
    throw new Error("PAYLOAD_TOO_LARGE");
  }

  return JSON.parse(rawBody || "{}");
}

export async function handlePatchArticleRequest(request: Request, siteId: string, idOrSlug: string) {
  try {
    const auth = await authorize(request, siteId);
    if (auth instanceof NextResponse) return auth;

    const json = await readJsonBody(request);
    const parsed = PatchArticleApiPayloadSchema.parse(json);

    const result = await applyArticleUpdate(siteId, idOrSlug, parsed, { mode: "patch" });

    if ("error" in result) return result.error;

    await touchApiKey(auth.apiKeyId);

    return NextResponse.json({
      siteId,
      article: serializeArticle(siteId, result.article)
    });
  } catch (error) {
    if (error instanceof Error && error.message === "PAYLOAD_TOO_LARGE") {
      return jsonError("Payload too large.", 413);
    }
    return handleUnknownError(error, "Failed to update article.");
  }
}

export async function handlePutArticleRequest(request: Request, siteId: string, idOrSlug: string) {
  try {
    const auth = await authorize(request, siteId);
    if (auth instanceof NextResponse) return auth;

    const json = await readJsonBody(request);
    const parsed = PutArticleApiPayloadSchema.parse(json);

    const result = await applyArticleUpdate(siteId, idOrSlug, parsed, { mode: "put" });

    if ("error" in result) return result.error;

    await touchApiKey(auth.apiKeyId);

    return NextResponse.json({
      siteId,
      article: serializeArticle(siteId, result.article)
    });
  } catch (error) {
    if (error instanceof Error && error.message === "PAYLOAD_TOO_LARGE") {
      return jsonError("Payload too large.", 413);
    }
    return handleUnknownError(error, "Failed to replace article.");
  }
}
