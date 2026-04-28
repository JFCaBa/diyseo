import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PublicBlogMetaLinks } from "@/components/public-blog-meta-links";
import { getCoverImageProxyPath, getCoverImageProxyUrl } from "@/lib/cover-image-url";
import { getAdjacentPublishedArticles, getPublishedArticleBySlugWithTranslation } from "@/lib/articles";
import { getArticleRenderedHtml } from "@/lib/markdown";
import { getPublicBlogTheme } from "@/lib/public-blog-theme";
import { getPublicUrls } from "@/lib/public-urls";
import { getRequestedTranslationLanguage, getTranslationQuerySuffix, pickArticleTranslation } from "@/lib/translations";
import { cn } from "@/lib/utils";
import { PublicArticleRouteParamsSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

type PublicArticlePageProps = {
  params: Promise<{ siteId: string; slug: string }>;
  searchParams?: Promise<{ lang?: string }>;
};

async function getArticleFromParams(params: PublicArticlePageProps["params"], searchParams?: PublicArticlePageProps["searchParams"]) {
  const parsed = PublicArticleRouteParamsSchema.safeParse(await params);

  if (!parsed.success) {
    return null;
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const language = getRequestedTranslationLanguage(typeof resolvedSearchParams?.lang === "string" ? resolvedSearchParams.lang : null);

  return getPublishedArticleBySlugWithTranslation(parsed.data.siteId, parsed.data.slug, language);
}

export async function generateMetadata({ params, searchParams }: PublicArticlePageProps): Promise<Metadata> {
  const parsed = PublicArticleRouteParamsSchema.safeParse(await params);

  if (!parsed.success) {
    return {};
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const language = getRequestedTranslationLanguage(typeof resolvedSearchParams?.lang === "string" ? resolvedSearchParams.lang : null);
  const article = await getPublishedArticleBySlugWithTranslation(parsed.data.siteId, parsed.data.slug, language);

  if (!article) {
    return {};
  }

  const translation = pickArticleTranslation(article);
  const title = translation?.seoTitle || article.seoTitle || article.title;
  const description = translation?.seoDescription || article.seoDescription || article.excerpt || undefined;
  const urls = await getPublicUrls(parsed.data.siteId);
  const url = `${urls.articleUrl(parsed.data.slug)}${getTranslationQuerySuffix(language)}`;

  return {
    title,
    description,
    robots: urls.isTenant ? undefined : { index: false, follow: false },
    alternates: {
      canonical: url
    },
    openGraph: {
      title,
      description,
      url,
      type: "article",
      siteName: article.siteProject?.name || "DIYSEO",
      images: article.coverImageUrl ? [{ url: getCoverImageProxyUrl(article.coverImageUrl, urls.origin || undefined) }] : undefined,
      publishedTime: article.publishedAt ? new Date(article.publishedAt).toISOString() : undefined
    },
    twitter: {
      card: article.coverImageUrl ? "summary_large_image" : "summary",
      title,
      description,
      images: article.coverImageUrl ? [getCoverImageProxyUrl(article.coverImageUrl, urls.origin || undefined)] : undefined
    }
  };
}

export default async function PublicArticlePage({ params, searchParams }: PublicArticlePageProps) {
  const article = await getArticleFromParams(params, searchParams);

  if (!article) {
    notFound();
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const language = getRequestedTranslationLanguage(typeof resolvedSearchParams?.lang === "string" ? resolvedSearchParams.lang : null);
  const languageQuerySuffix = getTranslationQuerySuffix(language);
  const translation = pickArticleTranslation(article);

  const urls = await getPublicUrls(article.siteProjectId);

  const { previousArticle, nextArticle } = await getAdjacentPublishedArticles(article.siteProjectId, {
    publishedAt: article.publishedAt ? new Date(article.publishedAt) : null,
    createdAt: new Date(article.createdAt)
  });

  const publishedDate = article.publishedAt
    ? new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric"
      }).format(new Date(article.publishedAt))
    : null;
  const theme = getPublicBlogTheme(article.siteProject?.widgetTheme);
  const displayTitle = translation?.title || article.title;
  const displayExcerpt = translation?.excerpt || article.excerpt;
  const renderedContentHtml = translation
    ? getArticleRenderedHtml(translation.contentMarkdown, article.contentHtml)
    : getArticleRenderedHtml(article.contentMarkdown, article.contentHtml);

  return (
    <main className={cn("min-h-screen px-4 py-10 sm:px-6 sm:py-12", theme.page)}>
      <article
        className={cn(
          "mx-auto max-w-3xl rounded-[2rem] border px-5 py-7 shadow-panel backdrop-blur sm:px-8 md:px-10 md:py-10",
          theme.shell,
          theme.surfaceText
        )}
      >
        <div className={cn("space-y-5 border-b pb-7", theme.divider)}>
          <Link
            href={urls.indexPath}
            className={cn("inline-flex text-sm font-semibold underline-offset-4 transition hover:underline", theme.link)}
          >
            ← Back to Blog
          </Link>
          <p className={cn("text-[11px] font-semibold uppercase tracking-[0.28em]", theme.eyebrow)}>
            {article.siteProject?.name || "DIYSEO"}
          </p>
          {article.coverImageUrl ? (
            <img
              src={getCoverImageProxyUrl(article.coverImageUrl, urls.imageProxyOrigin || undefined)}
              alt=""
              referrerPolicy="no-referrer"
              className={cn("h-auto w-full rounded-[1.75rem] border object-cover", theme.imageBorder)}
            />
          ) : null}
          <h1 className={cn("text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl", theme.title)}>{displayTitle}</h1>
          {displayExcerpt ? <p className={cn("max-w-2xl text-lg leading-8 sm:text-xl", theme.body)}>{displayExcerpt}</p> : null}
          {language ? (
            <p className={cn("text-[11px] font-semibold uppercase tracking-[0.22em]", theme.muted)}>
              Viewing translation: {language}
            </p>
          ) : null}
          {publishedDate ? (
            <p className={cn("text-[11px] font-semibold uppercase tracking-[0.22em]", theme.muted)}>Published {publishedDate}</p>
          ) : null}
        </div>

        <div
          className={cn("mt-10", theme.prose)}
          dangerouslySetInnerHTML={{ __html: renderedContentHtml }}
        />

        <nav className={cn("mt-10 border-t pt-6", theme.divider)} aria-label="Article navigation">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="sm:max-w-[32%]">
              {previousArticle ? (
                <Link
                  href={`${urls.articlePath(previousArticle.slug)}${languageQuerySuffix}`}
                  className={cn("block text-sm transition", theme.navText)}
                >
                  <span className={cn("block text-[11px] font-semibold uppercase tracking-[0.22em]", theme.eyebrow)}>Previous</span>
                  <span className={cn("mt-2 block text-base font-semibold leading-relaxed underline-offset-4 hover:underline", theme.navTitle)}>
                    ← {previousArticle.title}
                  </span>
                </Link>
              ) : null}
            </div>

            <div className="sm:text-center">
              <Link
                href={urls.indexPath}
                className={cn("inline-flex text-sm font-semibold underline-offset-4 transition hover:underline", theme.link)}
              >
                Back to Blog Index
              </Link>
            </div>

            <div className="sm:max-w-[32%] sm:text-right">
              {nextArticle ? (
                <Link
                  href={`${urls.articlePath(nextArticle.slug)}${languageQuerySuffix}`}
                  className={cn("block text-sm transition", theme.navText)}
                >
                  <span className={cn("block text-[11px] font-semibold uppercase tracking-[0.22em]", theme.eyebrow)}>Next</span>
                  <span className={cn("mt-2 block text-base font-semibold leading-relaxed underline-offset-4 hover:underline", theme.navTitle)}>
                    {nextArticle.title} →
                  </span>
                </Link>
              ) : null}
            </div>
          </div>
        </nav>

        <PublicBlogMetaLinks siteId={article.siteProjectId} theme={theme.mode} />
      </article>
    </main>
  );
}
