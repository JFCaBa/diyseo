import Link from "next/link";
import { notFound } from "next/navigation";

import { ArticleTranslationForm } from "@/components/article-translation-form";
import { ArticleEditorForm } from "@/components/article-editor-form";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type ArticleEditorPageProps = {
  params: Promise<{ siteId: string; articleId: string }>;
};

export default async function ArticleEditorPage({ params }: ArticleEditorPageProps) {
  const { siteId, articleId } = await params;

  const [article, site] = await Promise.all([
    prisma.article.findFirst({
      where: {
        id: articleId,
        siteProjectId: siteId
      },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        publishedAt: true,
        excerpt: true,
        coverImageUrl: true,
        contentHtml: true,
        contentMarkdown: true,
        seoTitle: true,
        seoDescription: true,
        translations: {
          orderBy: {
            language: "asc"
          },
          select: {
            language: true,
            updatedAt: true
          }
        }
      }
    }),
    prisma.siteProject.findFirst({
      where: {
        id: siteId
      },
      select: {
        translationsEnabled: true,
        translationLanguages: true
      }
    })
  ]);

  if (!article || !site) {
    notFound();
  }

  return (
    <section className="space-y-8">
      <PageHeader
        title="Edit Article"
        description="Update article copy, metadata, and Markdown while keeping the article in the same publishing workflow."
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/${siteId}/articles`}
              className="inline-flex items-center justify-center rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink transition hover:bg-mist"
            >
              Back to Articles
            </Link>
            {article.status === "PUBLISHED" ? (
              <Link
                href={`/${siteId}/preview?slug=${encodeURIComponent(article.slug)}`}
                className="inline-flex items-center justify-center rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                View Public Article
              </Link>
            ) : null}
          </div>
        }
      />
      <ArticleEditorForm article={article} siteId={siteId} />
      {site.translationsEnabled ? (
        <ArticleTranslationForm
          articleId={article.id}
          articleHasMarkdown={Boolean(article.contentMarkdown?.trim())}
          siteId={siteId}
          translationLanguages={site.translationLanguages}
          existingTranslations={article.translations.map((translation) => ({
            language: translation.language,
            updatedAt: translation.updatedAt.toISOString()
          }))}
        />
      ) : null}
    </section>
  );
}
