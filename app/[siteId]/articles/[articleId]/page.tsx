import Link from "next/link";
import { notFound } from "next/navigation";

import { ArticleEditorForm } from "@/components/article-editor-form";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type ArticleEditorPageProps = {
  params: Promise<{ siteId: string; articleId: string }>;
};

export default async function ArticleEditorPage({ params }: ArticleEditorPageProps) {
  const { siteId, articleId } = await params;

  const article = await prisma.article.findFirst({
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
      contentHtml: true,
      seoTitle: true,
      seoDescription: true
    }
  });

  if (!article) {
    notFound();
  }

  return (
    <section className="space-y-8">
      <PageHeader
        title="Edit Article"
        description="Update article copy, metadata, and HTML while keeping the article in the same publishing workflow."
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
                href={`/blog/${siteId}/${article.slug}`}
                className="inline-flex items-center justify-center rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                View Public Article
              </Link>
            ) : null}
          </div>
        }
      />
      <ArticleEditorForm article={article} siteId={siteId} />
    </section>
  );
}
