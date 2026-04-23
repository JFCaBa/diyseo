import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PublicBlogMetaLinks } from "@/components/public-blog-meta-links";
import { getCoverImageProxyPath, getCoverImageProxyUrl } from "@/lib/cover-image-url";
import { getAdjacentPublishedArticles, getPublishedArticleBySlug } from "@/lib/articles";
import { getPublicUrls } from "@/lib/public-urls";
import { PublicArticleRouteParamsSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

type PublicArticlePageProps = {
  params: Promise<{ siteId: string; slug: string }>;
};

async function getArticleFromParams(params: PublicArticlePageProps["params"]) {
  const parsed = PublicArticleRouteParamsSchema.safeParse(await params);

  if (!parsed.success) {
    return null;
  }

  return getPublishedArticleBySlug(parsed.data.siteId, parsed.data.slug);
}

export async function generateMetadata({ params }: PublicArticlePageProps): Promise<Metadata> {
  const parsed = PublicArticleRouteParamsSchema.safeParse(await params);

  if (!parsed.success) {
    return {};
  }

  const article = await getPublishedArticleBySlug(parsed.data.siteId, parsed.data.slug);

  if (!article) {
    return {};
  }

  const title = article.seoTitle || article.title;
  const description = article.seoDescription || article.excerpt || undefined;
  const urls = await getPublicUrls(parsed.data.siteId);
  const url = urls.articleUrl(parsed.data.slug);

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

export default async function PublicArticlePage({ params }: PublicArticlePageProps) {
  const article = await getArticleFromParams(params);

  if (!article) {
    notFound();
  }

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

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#1e293b_0%,#020617_55%,#020617_100%)] px-4 py-10 text-slate-100 sm:px-6 sm:py-12">
      <article className="mx-auto max-w-3xl rounded-[2rem] border border-slate-800 bg-slate-950/88 px-5 py-7 shadow-panel backdrop-blur sm:px-8 md:px-10 md:py-10">
        <div className="space-y-5 border-b border-slate-800 pb-7">
          <Link
            href={urls.indexPath}
            className="inline-flex text-sm font-semibold text-teal-300 underline-offset-4 transition hover:text-teal-200 hover:underline"
          >
            ← Back to Blog
          </Link>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-accent">
            {article.siteProject?.name || "DIYSEO"}
          </p>
          {article.coverImageUrl ? (
            <img
              src={getCoverImageProxyPath(article.coverImageUrl)}
              alt=""
              referrerPolicy="no-referrer"
              className="h-auto w-full rounded-[1.75rem] border border-slate-800 object-cover"
            />
          ) : null}
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">{article.title}</h1>
          {article.excerpt ? <p className="max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">{article.excerpt}</p> : null}
          {publishedDate ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Published {publishedDate}</p>
          ) : null}
        </div>

        <div
          className="prose prose-invert prose-lg mt-10 max-w-none leading-relaxed prose-headings:tracking-tight prose-headings:text-white prose-p:text-slate-300 prose-li:text-slate-300 prose-strong:text-white prose-a:text-teal-300 prose-a:decoration-teal-400/40 prose-a:underline-offset-4 prose-blockquote:border-l-slate-600 prose-blockquote:text-slate-300 prose-code:rounded prose-code:bg-slate-900 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-slate-100 prose-pre:border prose-pre:border-slate-800 prose-pre:bg-slate-900 prose-pre:text-slate-100"
          dangerouslySetInnerHTML={{ __html: article.contentHtml }}
        />

        <nav className="mt-10 border-t border-slate-800 pt-6" aria-label="Article navigation">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="sm:max-w-[32%]">
              {previousArticle ? (
                <Link
                  href={urls.articlePath(previousArticle.slug)}
                  className="block text-sm text-slate-400 transition hover:text-white"
                >
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-300">Previous</span>
                  <span className="mt-2 block text-base font-semibold leading-relaxed text-white underline-offset-4 hover:underline">
                    ← {previousArticle.title}
                  </span>
                </Link>
              ) : null}
            </div>

            <div className="sm:text-center">
              <Link
                href={urls.indexPath}
                className="inline-flex text-sm font-semibold text-teal-300 underline-offset-4 transition hover:text-teal-200 hover:underline"
              >
                Back to Blog Index
              </Link>
            </div>

            <div className="sm:max-w-[32%] sm:text-right">
              {nextArticle ? (
                <Link
                  href={urls.articlePath(nextArticle.slug)}
                  className="block text-sm text-slate-400 transition hover:text-white"
                >
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-teal-300">Next</span>
                  <span className="mt-2 block text-base font-semibold leading-relaxed text-white underline-offset-4 hover:underline">
                    {nextArticle.title} →
                  </span>
                </Link>
              ) : null}
            </div>
          </div>
        </nav>

        <PublicBlogMetaLinks siteId={article.siteProjectId} />
      </article>
    </main>
  );
}
