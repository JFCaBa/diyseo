import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PublicBlogMetaLinks } from "@/components/public-blog-meta-links";
import { getCoverImageProxyUrl } from "@/lib/cover-image-url";
import { getPublicSite, getPublishedArticles } from "@/lib/articles";
import { getPublicBlogTheme } from "@/lib/public-blog-theme";
import { getPublicUrls } from "@/lib/public-urls";
import { cn } from "@/lib/utils";
import { PublicBlogIndexRouteParamsSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

type PublicBlogIndexPageProps = {
  params: Promise<{ siteId: string }>;
};

async function getIndexData(params: PublicBlogIndexPageProps["params"]) {
  const parsed = PublicBlogIndexRouteParamsSchema.safeParse(await params);

  if (!parsed.success) {
    return null;
  }

  const site = await getPublicSite(parsed.data.siteId);

  if (!site) {
    return null;
  }

  const articles = await getPublishedArticles(parsed.data.siteId);

  return {
    site,
    articles
  };
}

export async function generateMetadata({ params }: PublicBlogIndexPageProps): Promise<Metadata> {
  const data = await getIndexData(params);

  if (!data) {
    return {};
  }

  const title = `${data.site.name} Blog`;
  const description = `Read the latest articles and updates from ${data.site.name}.`;
  const urls = await getPublicUrls(data.site.id);

  return {
    title,
    description,
    robots: urls.isTenant ? undefined : { index: false, follow: false },
    alternates: {
      canonical: urls.indexUrl,
      types: {
        "application/rss+xml": urls.rssUrl,
        "application/atom+xml": urls.atomUrl
      }
    },
    openGraph: {
      title,
      description,
      url: urls.indexUrl,
      type: "website",
      siteName: data.site.name,
      images: data.articles[0]?.coverImageUrl ? [{ url: data.articles[0].coverImageUrl }] : undefined
    },
    twitter: {
      card: "summary",
      title,
      description
    }
  };
}

export default async function PublicBlogIndexPage({ params }: PublicBlogIndexPageProps) {
  const data = await getIndexData(params);

  if (!data) {
    notFound();
  }

  const urls = await getPublicUrls(data.site.id);
  const theme = getPublicBlogTheme(data.site.widgetTheme);

  return (
    <main className={cn("min-h-screen px-4 py-10 sm:px-6 sm:py-12", theme.page)}>
      <section className={cn("mx-auto max-w-4xl rounded-[2rem] border px-5 py-7 shadow-panel backdrop-blur sm:px-8 md:px-10 md:py-10", theme.shell)}>
        <div className={cn("space-y-4 border-b pb-7", theme.divider)}>
          <p className={cn("text-[11px] font-semibold uppercase tracking-[0.28em]", theme.eyebrow)}>Public Blog</p>
          <h1 className={cn("text-3xl font-semibold tracking-tight sm:text-4xl", theme.title)}>{data.site.name} Blog</h1>
          <p className={cn("max-w-2xl text-sm leading-7 sm:text-base", theme.body)}>
            Published articles from {data.site.name}, served directly from the DIYSEO app.
          </p>
        </div>

        {data.articles.length === 0 ? (
          <div className={cn("mt-10 rounded-3xl border border-dashed px-6 py-10 text-center", theme.empty)}>
            <p className={cn("text-lg font-semibold", theme.title)}>No articles published yet.</p>
            <p className={cn("mt-2 text-sm", theme.muted)}>Check back later for new posts from this site.</p>
          </div>
        ) : (
          <div className="mt-10 space-y-6">
            {data.articles.map((article) => {
              const publishedDate = article.publishedAt
                ? new Intl.DateTimeFormat("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric"
                  }).format(new Date(article.publishedAt))
                : null;

              return (
                <article
                  key={article.id}
                  className={cn("rounded-3xl border px-5 py-5 transition sm:px-6 sm:py-6", theme.card)}
                >
                  <Link href={urls.articlePath(article.slug)} className="flex items-start gap-5">
                    {article.coverImageUrl ? (
                      <img
                        src={getCoverImageProxyUrl(article.coverImageUrl, urls.imageProxyOrigin || undefined)}
                        alt=""
                        referrerPolicy="no-referrer"
                        className={cn("h-24 w-24 shrink-0 rounded-2xl border object-cover sm:h-28 sm:w-28", theme.imageBorder)}
                      />
                    ) : null}
                    <div className="min-w-0 space-y-2">
                      <p className={cn("text-lg font-semibold leading-snug tracking-tight underline-offset-4 transition hover:underline", theme.titleLink)}>
                        {article.title}
                      </p>
                      {article.excerpt ? (
                        <p className={cn("line-clamp-2 text-sm leading-relaxed", theme.body)}>{article.excerpt}</p>
                      ) : null}
                      {publishedDate ? (
                        <p className={cn("text-[11px] font-semibold uppercase tracking-[0.22em]", theme.muted)}>
                          {publishedDate}
                        </p>
                      ) : null}
                    </div>
                  </Link>
                </article>
              );
            })}
          </div>
        )}

        <PublicBlogMetaLinks siteId={data.site.id} theme={theme.mode} />
      </section>
    </main>
  );
}
