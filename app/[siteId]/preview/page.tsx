import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { getCoverImageProxyPath } from "@/lib/cover-image-url";
import {
  getAdjacentPublishedArticles,
  getPublicSite,
  getPublishedArticleBySlug,
  getPublishedArticles
} from "@/lib/articles";

export const dynamic = "force-dynamic";

type PreviewPageProps = {
  params: Promise<{ siteId: string }>;
  searchParams?: Promise<{ slug?: string }>;
};

function formatPublishedDate(value: Date | string | null) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(new Date(value));
}

export default async function PreviewPage({ params, searchParams }: PreviewPageProps) {
  const { siteId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const slug = typeof resolvedSearchParams?.slug === "string" ? resolvedSearchParams.slug.trim() : "";

  const site = await getPublicSite(siteId);

  if (!site) {
    notFound();
  }

  if (slug) {
    const article = await getPublishedArticleBySlug(siteId, slug);

    if (!article) {
      notFound();
    }

    const { previousArticle, nextArticle } = await getAdjacentPublishedArticles(siteId, {
      publishedAt: article.publishedAt ? new Date(article.publishedAt) : null,
      createdAt: new Date(article.createdAt)
    });

    const publishedDate = formatPublishedDate(article.publishedAt);

    return (
      <section className="space-y-8">
        <PageHeader
          title="Blog Preview"
          description="Preview the public article inside the admin shell without leaving the product."
          action={
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={`/${siteId}/preview`}
                className="inline-flex items-center justify-center rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink transition hover:bg-mist"
              >
                Back to Blog Preview
              </Link>
              <Link
                href={`/blog/${siteId}/${article.slug}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Open public article
              </Link>
            </div>
          }
        />

        <article className="rounded-[2rem] border border-slate-800 bg-slate-950/88 px-5 py-7 text-slate-100 shadow-panel sm:px-8 md:px-10 md:py-10">
          <div className="space-y-5 border-b border-slate-800 pb-7">
            <Link
              href={`/${siteId}/preview`}
              className="inline-flex text-sm font-semibold text-teal-300 underline-offset-4 transition hover:text-teal-200 hover:underline"
            >
              ← Back to Preview Index
            </Link>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-teal-300">{site.name}</p>
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
                    href={`/${siteId}/preview?slug=${encodeURIComponent(previousArticle.slug)}`}
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
                  href={`/${siteId}/preview`}
                  className="inline-flex text-sm font-semibold text-teal-300 underline-offset-4 transition hover:text-teal-200 hover:underline"
                >
                  Back to Blog Preview
                </Link>
              </div>

              <div className="sm:max-w-[32%] sm:text-right">
                {nextArticle ? (
                  <Link
                    href={`/${siteId}/preview?slug=${encodeURIComponent(nextArticle.slug)}`}
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
        </article>
      </section>
    );
  }

  const articles = await getPublishedArticles(siteId);

  return (
    <section className="space-y-8">
      <PageHeader
        title="Blog Preview"
        description="Preview the public blog inside the admin shell while keeping the site navigation visible."
        action={
          <Link
            href={`/blog/${siteId}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink transition hover:bg-mist"
          >
            Open public blog
          </Link>
        }
      />

      <section className="rounded-[2rem] border border-slate-800 bg-slate-950/85 px-5 py-7 text-slate-100 shadow-panel sm:px-8 md:px-10 md:py-10">
        <div className="space-y-4 border-b border-slate-800 pb-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-teal-300">Public Blog Preview</p>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">{site.name} Blog</h1>
          <p className="max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
            This is the same published content, rendered inside the admin app so you can preview without leaving the shell.
          </p>
        </div>

        {articles.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-dashed border-slate-700 bg-slate-900/60 px-6 py-10 text-center">
            <p className="text-lg font-semibold text-white">No articles published yet.</p>
            <p className="mt-2 text-sm text-slate-400">Publish an article to preview the public blog here.</p>
          </div>
        ) : (
          <div className="mt-10 space-y-6">
            {articles.map((article) => {
              const publishedDate = formatPublishedDate(article.publishedAt);

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
                        href={`/${siteId}/preview?slug=${encodeURIComponent(article.slug)}`}
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
                        href={`/${siteId}/preview?slug=${encodeURIComponent(article.slug)}`}
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
      </section>
    </section>
  );
}
