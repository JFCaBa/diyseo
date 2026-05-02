import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { createUniqueArticleSlug, normalizeArticleSlug } from "@/lib/article-slug";
import { buildAdminArticleUrl, buildPublicArticleUrl } from "@/lib/app-origin";
import { generateAndSaveArticleCoverImage } from "@/lib/generate-cover-image";
import { renderMarkdownToHtml } from "@/lib/markdown";
import { prisma } from "@/lib/prisma";
import { extractPublishingApiKey, findActivePublishingApiKeyForSite } from "@/lib/site-publishing-api";
import { PublishArticleApiPayloadSchema } from "@/lib/validations";

const MAX_PUBLISH_PAYLOAD_CHARS = 200_000;

export async function handlePublishArticleRequest(request: Request, siteId: string) {
  try {
    const rawKey = extractPublishingApiKey(request);

    if (!rawKey) {
      return NextResponse.json({ error: "Missing publishing API key." }, { status: 401 });
    }

    const apiKey = await findActivePublishingApiKeyForSite(siteId, rawKey);

    if (!apiKey) {
      return NextResponse.json({ error: "Invalid or revoked publishing API key." }, { status: 401 });
    }

    const rawBody = await request.text();

    if (rawBody.length > MAX_PUBLISH_PAYLOAD_CHARS) {
      return NextResponse.json({ error: "Payload too large." }, { status: 413 });
    }

    const parsed = PublishArticleApiPayloadSchema.parse(JSON.parse(rawBody || "{}"));
    const requestedSlug = parsed.slug?.trim() ? normalizeArticleSlug(parsed.slug) : "";

    if (parsed.slug?.trim() && !requestedSlug) {
      return NextResponse.json({ error: "Slug is invalid after normalization." }, { status: 400 });
    }

    const slug = await createUniqueArticleSlug(siteId, requestedSlug || parsed.title);
    const status = parsed.status ?? "DRAFT";
    const publishedAt = status === "PUBLISHED" ? (parsed.publishedAt ? new Date(parsed.publishedAt) : new Date()) : null;

    const article = await prisma.$transaction(async (tx) => {
      const created = await tx.article.create({
        data: {
          siteProjectId: siteId,
          title: parsed.title,
          slug,
          excerpt: parsed.excerpt ?? null,
          coverImageUrl: parsed.coverImageUrl ?? null,
          contentMarkdown: parsed.contentMarkdown,
          contentHtml: renderMarkdownToHtml(parsed.contentMarkdown),
          seoTitle: parsed.seoTitle ?? null,
          seoDescription: parsed.seoDescription ?? null,
          status,
          publishedAt
        },
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
          publishedAt: true
        }
      });

      await tx.sitePublishingApiKey.update({
        where: { id: apiKey.id },
        data: {
          lastUsedAt: new Date()
        }
      });

      return created;
    });

    revalidatePath(`/${siteId}/articles`);
    revalidatePath(`/${siteId}/calendar`);
    revalidatePath(`/api/public/sites/${siteId}/articles`);

    if (article.status === "PUBLISHED") {
      revalidatePath(`/blog/${siteId}`);
      revalidatePath(`/blog/${siteId}/${article.slug}`);
      revalidatePath(`/api/public/sites/${siteId}/articles/${article.slug}`);
    }

    if (parsed.generateCoverImage) {
      void generateAndSaveArticleCoverImage({ siteId, articleId: article.id })
        .then(() => {
          revalidatePath(`/${siteId}/articles`);
          revalidatePath(`/${siteId}/articles/${article.id}`);
          revalidatePath(`/api/public/sites/${siteId}/articles`);
          if (article.status === "PUBLISHED") {
            revalidatePath(`/blog/${siteId}`);
            revalidatePath(`/blog/${siteId}/${article.slug}`);
            revalidatePath(`/api/public/sites/${siteId}/articles/${article.slug}`);
          }
        })
        .catch((error) => {
          console.error(
            `publish-article-api: cover image generation failed for article ${article.id}:`,
            error instanceof Error ? error.message : error
          );
        });
    }

    return NextResponse.json(
      {
        id: article.id,
        title: article.title,
        slug: article.slug,
        status: article.status,
        publishedAt: article.publishedAt,
        publicUrl: article.status === "PUBLISHED" ? buildPublicArticleUrl(siteId, article.slug) : null,
        editorUrl: buildAdminArticleUrl(siteId, article.id)
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: error.issues[0]?.message ?? "Invalid publish payload."
        },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : "Article publish failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
