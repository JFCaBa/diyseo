import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { getCoverImageProxyPath } from "@/lib/cover-image-url";
import {
  getAdjacentPublishedArticles,
  getPublicSite,
  getPublishedArticleBySlugWithTranslation,
  getPublishedArticles
} from "@/lib/articles";
import { getArticleRenderedHtml } from "@/lib/markdown";
import { getT } from "@/lib/i18n/server";
import { formatBlogDate, getBlogStrings, resolveBlogLocale } from "@/lib/public-blog-i18n";
import { getPublicBlogTheme } from "@/lib/public-blog-theme";
import { getRequestedTranslationLanguage, getTranslationQuerySuffix, pickArticleTranslation } from "@/lib/translations";
import { cn } from "@/lib/utils";
import { requireSitePage } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";

type PreviewPageProps = {
  params: Promise<{ siteId: string }>;
  searchParams?: Promise<{ slug?: string; lang?: string }>;
};

export default async function PreviewPage({ params, searchParams }: PreviewPageProps) {
  const { siteId } = await params;
  await requireSitePage(siteId);
  const t = await getT();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const slug = typeof resolvedSearchParams?.slug === "string" ? resolvedSearchParams.slug.trim() : "";
  const language = getRequestedTranslationLanguage(typeof resolvedSearchParams?.lang === "string" ? resolvedSearchParams.lang : null);
  const languageQuerySuffix = getTranslationQuerySuffix(language);

  const site = await getPublicSite(siteId);

  if (!site) {
    notFound();
  }

  const blogLocale = resolveBlogLocale(site.contentLanguage);
  const blog = getBlogStrings(blogLocale);
  const formatPublishedDate = (value: Date | string | null) => (value ? formatBlogDate(value, blogLocale) : null);

  if (slug) {
    const article = await getPublishedArticleBySlugWithTranslation(siteId, slug, language);

    if (!article) {
      notFound();
    }

    const translation = pickArticleTranslation(article);

    const { previousArticle, nextArticle } = await getAdjacentPublishedArticles(siteId, {
      publishedAt: article.publishedAt ? new Date(article.publishedAt) : null,
      createdAt: new Date(article.createdAt)
    });

    const publishedDate = formatPublishedDate(article.publishedAt);
    const theme = getPublicBlogTheme(site.widgetTheme);
    const displayTitle = translation?.title || article.title;
    const displayExcerpt = translation?.excerpt || article.excerpt;
    const renderedContentHtml = translation
      ? getArticleRenderedHtml(translation.contentMarkdown, article.contentHtml)
      : getArticleRenderedHtml(article.contentMarkdown, article.contentHtml);

    return (
      <section className="space-y-8">
        <PageHeader
          title={t("articles.preview.title")}
          description={t("articles.preview.articleDescription")}
          action={
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={`/${siteId}/preview${languageQuerySuffix}`}
                className="inline-flex items-center justify-center rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink transition hover:bg-mist"
              >
                {t("articles.preview.backToBlogPreview")}
              </Link>
              <Link
                href={`/blog/${siteId}/${article.slug}${languageQuerySuffix}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                {t("articles.preview.openPublicArticle")}
              </Link>
            </div>
          }
        />

        <article
          className={cn("rounded-[2rem] border px-5 py-7 shadow-panel sm:px-8 md:px-10 md:py-10", theme.shell, theme.surfaceText)}
        >
          <div className={cn("space-y-5 border-b pb-7", theme.divider)}>
            <Link
              href={`/${siteId}/preview${languageQuerySuffix}`}
              className={cn("inline-flex text-sm font-semibold underline-offset-4 transition hover:underline", theme.link)}
            >
              {t("articles.preview.backToIndex")}
            </Link>
            <p className={cn("text-[11px] font-semibold uppercase tracking-[0.28em]", theme.eyebrow)}>{site.name}</p>
            {article.coverImageUrl ? (
              <img
                src={getCoverImageProxyPath(article.coverImageUrl)}
                alt=""
                referrerPolicy="no-referrer"
                className={cn("h-auto w-full rounded-[1.75rem] border object-cover", theme.imageBorder)}
              />
            ) : null}
            <h1 className={cn("text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl", theme.title)}>{displayTitle}</h1>
            {displayExcerpt ? <p className={cn("max-w-2xl text-lg leading-8 sm:text-xl", theme.body)}>{displayExcerpt}</p> : null}
            {language ? (
              <p className={cn("text-[11px] font-semibold uppercase tracking-[0.22em]", theme.muted)}>
                {blog.viewingTranslation(language)}
              </p>
            ) : null}
            {publishedDate ? (
              <p className={cn("text-[11px] font-semibold uppercase tracking-[0.22em]", theme.muted)}>{blog.published(publishedDate)}</p>
            ) : null}
          </div>

          <div
            className={cn("mt-10", theme.prose)}
            dangerouslySetInnerHTML={{ __html: renderedContentHtml }}
          />

          <nav className={cn("mt-10 border-t pt-6", theme.divider)} aria-label={blog.articleNavLabel}>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="sm:max-w-[32%]">
                {previousArticle ? (
                  <Link
                    href={`/${siteId}/preview?slug=${encodeURIComponent(previousArticle.slug)}${language ? `&lang=${encodeURIComponent(language)}` : ""}`}
                    className={cn("block text-sm transition", theme.navText)}
                  >
                    <span className={cn("block text-[11px] font-semibold uppercase tracking-[0.22em]", theme.eyebrow)}>{blog.previous}</span>
                    <span className={cn("mt-2 block text-base font-semibold leading-relaxed underline-offset-4 hover:underline", theme.navTitle)}>
                      ← {previousArticle.title}
                    </span>
                  </Link>
                ) : null}
              </div>

              <div className="sm:text-center">
                <Link
                  href={`/${siteId}/preview${languageQuerySuffix}`}
                  className={cn("inline-flex text-sm font-semibold underline-offset-4 transition hover:underline", theme.link)}
                >
                  {t("articles.preview.backToBlogPreview")}
                </Link>
              </div>

              <div className="sm:max-w-[32%] sm:text-right">
                {nextArticle ? (
                  <Link
                    href={`/${siteId}/preview?slug=${encodeURIComponent(nextArticle.slug)}${language ? `&lang=${encodeURIComponent(language)}` : ""}`}
                    className={cn("block text-sm transition", theme.navText)}
                  >
                    <span className={cn("block text-[11px] font-semibold uppercase tracking-[0.22em]", theme.eyebrow)}>{blog.next}</span>
                    <span className={cn("mt-2 block text-base font-semibold leading-relaxed underline-offset-4 hover:underline", theme.navTitle)}>
                      {nextArticle.title} →
                    </span>
                  </Link>
                ) : null}
              </div>
            </div>
          </nav>
        </article>
      </section>
    );
  }

  const articles = await getPublishedArticles(siteId);
  const theme = getPublicBlogTheme(site.widgetTheme);

  return (
    <section className="space-y-8">
      <PageHeader
        title={t("articles.preview.title")}
        description={t("articles.preview.indexDescription")}
        action={
          <Link
            href={`/blog/${siteId}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink transition hover:bg-mist"
          >
            {t("articles.preview.openPublicBlog")}
          </Link>
        }
      />

      <section className={cn("rounded-[2rem] border px-5 py-7 shadow-panel sm:px-8 md:px-10 md:py-10", theme.shell, theme.surfaceText)}>
        <div className={cn("space-y-4 border-b pb-7", theme.divider)}>
          <p className={cn("text-[11px] font-semibold uppercase tracking-[0.28em]", theme.eyebrow)}>{t("articles.preview.eyebrow")}</p>
          <h1 className={cn("text-3xl font-semibold tracking-tight sm:text-4xl", theme.title)}>{blog.blogTitle(site.name)}</h1>
          <p className={cn("max-w-2xl text-sm leading-7 sm:text-base", theme.body)}>
            {t("articles.preview.intro")}
          </p>
        </div>

        {articles.length === 0 ? (
          <div className={cn("mt-10 rounded-3xl border border-dashed px-6 py-10 text-center", theme.empty)}>
            <p className={cn("text-lg font-semibold", theme.title)}>{blog.emptyTitle}</p>
            <p className={cn("mt-2 text-sm", theme.muted)}>{t("articles.preview.emptyBody")}</p>
          </div>
        ) : (
          <div className="mt-10 space-y-6">
            {articles.map((article) => {
              const publishedDate = formatPublishedDate(article.publishedAt);

              return (
                <article
                  key={article.id}
                  className={cn("rounded-3xl border px-5 py-5 transition sm:px-6 sm:py-6", theme.card)}
                >
                  <Link
                    href={`/${siteId}/preview?slug=${encodeURIComponent(article.slug)}`}
                    className="flex items-start gap-5"
                  >
                    {article.coverImageUrl ? (
                      <img
                        src={getCoverImageProxyPath(article.coverImageUrl)}
                        alt=""
                        referrerPolicy="no-referrer"
                        className={cn("h-24 w-24 shrink-0 rounded-2xl border object-cover sm:h-28 sm:w-28", theme.imageBorder)}
                      />
                    ) : null}
                    <div className="min-w-0 space-y-2">
                      <p
                        className={cn(
                          "text-lg font-semibold leading-snug tracking-tight underline-offset-4 transition hover:underline",
                          theme.titleLink
                        )}
                      >
                        {article.title}
                      </p>
                      {article.excerpt ? (
                        <p className={cn("line-clamp-2 text-sm leading-relaxed", theme.body)}>{article.excerpt}</p>
                      ) : null}
                      {publishedDate ? (
                        <p className={cn("text-[11px] font-semibold uppercase tracking-[0.22em]", theme.muted)}>
                          {blog.published(publishedDate)}
                        </p>
                      ) : null}
                    </div>
                  </Link>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}
