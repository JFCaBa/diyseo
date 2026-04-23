import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PublicBlogMetaLinks } from "@/components/public-blog-meta-links";
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
      publishedTime: article.publishedAt ? new Date(article.publishedAt).toISOString() : undefined
    },
    twitter: {
      card: "summary",
      title,
      description
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
    <main className="min-h-screen bg-sand/40 px-4 py-10 sm:px-6 sm:py-12">
      <article className="mx-auto max-w-3xl rounded-[2rem] border border-line bg-white px-5 py-7 shadow-panel sm:px-8 md:px-10 md:py-10">
        <div className="space-y-5 border-b border-line pb-7">
          <Link
            href={urls.indexPath}
            className="inline-flex text-sm font-semibold text-accent underline-offset-4 transition hover:text-teal-700 hover:underline"
          >
            ← Back to Blog
          </Link>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-accent">
            {article.siteProject?.name || "DIYSEO"}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl md:text-5xl">{article.title}</h1>
          {article.excerpt ? <p className="max-w-2xl text-lg leading-8 text-slate-700 sm:text-xl">{article.excerpt}</p> : null}
          {publishedDate ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Published {publishedDate}</p>
          ) : null}
        </div>

        <div
          className="prose prose-slate prose-lg mt-10 max-w-none leading-relaxed prose-headings:tracking-tight prose-headings:text-slate-900 prose-p:text-slate-700 prose-li:text-slate-700 prose-strong:text-slate-900 prose-a:text-accent prose-a:decoration-accent/30 prose-a:underline-offset-4 hover:prose-a:text-teal-700"
          dangerouslySetInnerHTML={{ __html: article.contentHtml }}
        />

        <nav className="mt-10 border-t border-line pt-6" aria-label="Article navigation">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="sm:max-w-[32%]">
              {previousArticle ? (
                <Link
                  href={urls.articlePath(previousArticle.slug)}
                  className="block text-sm text-slate-500 transition hover:text-slate-900"
                >
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">Previous</span>
                  <span className="mt-2 block text-base font-semibold leading-relaxed text-slate-900 underline-offset-4 hover:underline">
                    ← {previousArticle.title}
                  </span>
                </Link>
              ) : null}
            </div>

            <div className="sm:text-center">
              <Link
                href={urls.indexPath}
                className="inline-flex text-sm font-semibold text-accent underline-offset-4 transition hover:text-teal-700 hover:underline"
              >
                Back to Blog Index
              </Link>
            </div>

            <div className="sm:max-w-[32%] sm:text-right">
              {nextArticle ? (
                <Link
                  href={urls.articlePath(nextArticle.slug)}
                  className="block text-sm text-slate-500 transition hover:text-slate-900"
                >
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-accent">Next</span>
                  <span className="mt-2 block text-base font-semibold leading-relaxed text-slate-900 underline-offset-4 hover:underline">
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
