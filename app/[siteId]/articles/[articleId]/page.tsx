import Link from "next/link";
import { notFound } from "next/navigation";

import { ArticleTranslationForm } from "@/components/article-translation-form";
import { ArticleEditorForm } from "@/components/article-editor-form";
import { PageHeader } from "@/components/page-header";
import { SocialPostsPanel } from "@/components/social-posts-panel";
import { getT } from "@/lib/i18n/server";
import { prisma } from "@/lib/prisma";
import { effectiveStatus } from "@/lib/social/rules";
import { isLocalCover } from "@/lib/social/social-image";
import { articleShareUrl } from "@/lib/social/urls";
import { requireSitePage } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";

type ArticleEditorPageProps = {
  params: Promise<{ siteId: string; articleId: string }>;
};

export default async function ArticleEditorPage({ params }: ArticleEditorPageProps) {
  const { siteId, articleId } = await params;
  await requireSitePage(siteId);
  const t = await getT();

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
        },
        socialPosts: {
          select: { id: true, network: true, text: true, status: true, updatedAt: true, error: true, externalUrl: true }
        }
      }
    }),
    prisma.siteProject.findFirst({
      where: {
        id: siteId
      },
      select: {
        id: true,
        domain: true,
        proxyVerifiedAt: true,
        translationsEnabled: true,
        translationLanguages: true,
        socialConnection: { select: { pageName: true, instagramUsername: true, instagramAccountId: true } }
      }
    })
  ]);

  if (!article || !site) {
    notFound();
  }

  const now = new Date();

  return (
    <section className="space-y-8">
      <PageHeader
        title={t("editor.page.title")}
        description={t("editor.page.description")}
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/${siteId}/articles`}
              className="inline-flex items-center justify-center rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink transition hover:bg-mist"
            >
              {t("editor.page.backToArticles")}
            </Link>
            {article.status === "PUBLISHED" ? (
              <Link
                href={`/${siteId}/preview?slug=${encodeURIComponent(article.slug)}`}
                className="inline-flex items-center justify-center rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                {t("editor.page.viewPublic")}
              </Link>
            ) : null}
          </div>
        }
      />
      <ArticleEditorForm article={article} siteId={siteId} />
      <SocialPostsPanel
        siteId={siteId}
        articleId={article.id}
        articleStatus={article.status}
        shareUrl={articleShareUrl(site, article.slug)}
        hasLocalCover={isLocalCover(article.coverImageUrl)}
        connection={
          site.socialConnection
            ? {
                pageName: site.socialConnection.pageName,
                instagramUsername: site.socialConnection.instagramUsername,
                hasInstagram: Boolean(site.socialConnection.instagramAccountId)
              }
            : null
        }
        posts={article.socialPosts.map((post) => ({
          id: post.id,
          network: post.network,
          text: post.text,
          status: effectiveStatus(post, now),
          error: post.error,
          externalUrl: post.externalUrl
        }))}
      />
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
