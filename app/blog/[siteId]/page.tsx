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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#1e293b_0%,#020617_55%,#020617_100%)] px-4 py-10 text-slate-100 sm:px-6 sm:py-12">
      <section className="mx-auto max-w-4xl rounded-[2rem] border border-slate-800 bg-slate-950/85 px-5 py-7 shadow-panel backdrop-blur sm:px-8 md:px-10 md:py-10">
        <div className="space-y-4 border-b border-slate-800 pb-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-teal-300">Public Blog</p>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">{data.site.name} Blog</h1>
          <p className="max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
            Published articles from {data.site.name}, served directly from the DIYSEO app.
          </p>
        </div>

        {data.articles.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-dashed border-slate-700 bg-slate-900/60 px-6 py-10 text-center">
            <p className="text-lg font-semibold text-white">No articles published yet.</p>
            <p className="mt-2 text-sm text-slate-400">Check back later for new posts from this site.</p>
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
                  className="rounded-3xl border border-slate-800 bg-slate-900/70 px-5 py-5 transition hover:border-slate-700 hover:bg-slate-900 sm:px-6 sm:py-6"
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
                        className="block text-2xl font-semibold tracking-tight text-white decoration-transparent underline-offset-4 transition hover:text-teal-300 hover:decoration-teal-300 hover:underline"
                      >
                        {article.title}
                      </Link>
                      {publishedDate ? (
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                          Published {publishedDate}
                        </p>
                      ) : null}
                    </div>
                    {article.excerpt ? <p className="text-base leading-relaxed text-slate-300">{article.excerpt}</p> : null}
                    <div>
                      <Link
                        href={`/blog/${data.site.id}/${article.slug}`}
                        className="text-sm font-semibold text-teal-300 underline-offset-4 transition hover:text-teal-200 hover:underline"
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
