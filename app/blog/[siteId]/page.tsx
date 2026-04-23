import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PublicBlogMetaLinks } from "@/components/public-blog-meta-links";
import { getCoverImageProxyPath } from "@/lib/cover-image-url";
import { getPublicSite, getPublishedArticles } from "@/lib/articles";
import { getPublicUrls } from "@/lib/public-urls";
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

  return (
    <main className="min-h-screen bg-sand/40 px-4 py-10 sm:px-6 sm:py-12">
      <section className="mx-auto max-w-4xl rounded-[2rem] border border-line bg-white px-5 py-7 shadow-panel sm:px-8 md:px-10 md:py-10">
        <div className="space-y-4 border-b border-line pb-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-accent">Public Blog</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">{data.site.name} Blog</h1>
          <p className="max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
            Published articles from {data.site.name}, served directly from the DIYSEO app.
          </p>
        </div>

        {data.articles.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-dashed border-line bg-mist/70 px-6 py-10 text-center">
            <p className="text-lg font-semibold text-slate-900">No articles published yet.</p>
            <p className="mt-2 text-sm text-slate-600">Check back later for new posts from this site.</p>
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
                  className="rounded-3xl border border-line bg-white px-5 py-5 transition hover:border-slate-300 hover:bg-mist/40 sm:px-6 sm:py-6"
                >
                  <div className="space-y-4">
                    {article.coverImageUrl ? (
                      <img
                        src={getCoverImageProxyPath(article.coverImageUrl)}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="h-56 w-full rounded-[1.5rem] border border-line object-cover"
                      />
                    ) : null}
                    <div className="space-y-3">
                      <Link
                        href={urls.articlePath(article.slug)}
                        className="block text-2xl font-semibold tracking-tight text-slate-900 decoration-transparent underline-offset-4 transition hover:text-accent hover:decoration-accent hover:underline"
                      >
                        {article.title}
                      </Link>
                      {publishedDate ? (
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                          Published {publishedDate}
                        </p>
                      ) : null}
                    </div>
                    {article.excerpt ? <p className="text-base leading-relaxed text-slate-600">{article.excerpt}</p> : null}
                    <div>
                      <Link
                        href={`/blog/${data.site.id}/${article.slug}`}
                        className="text-sm font-semibold text-accent underline-offset-4 transition hover:text-teal-700 hover:underline"
                      >
                        Read article
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <PublicBlogMetaLinks siteId={data.site.id} />
      </section>
    </main>
  );
}
