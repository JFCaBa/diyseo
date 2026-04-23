import Link from "next/link";

import { ArticleCreateForm } from "@/components/article-create-form";
import { PageHeader } from "@/components/page-header";

export const dynamic = "force-dynamic";

type NewArticlePageProps = {
  params: Promise<{ siteId: string }>;
  searchParams: Promise<{ date?: string; returnTo?: string }>;
};

function getInitialDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return "";
  }

  return value;
}

export default async function NewArticlePage({ params, searchParams }: NewArticlePageProps) {
  const { siteId } = await params;
  const query = await searchParams;
  const initialDate = getInitialDate(query.date);
  const returnTo = query.returnTo || `/${siteId}/calendar`;

  return (
    <section className="space-y-8">
      <PageHeader
        title="New Article"
        description="Start a manual draft here, then continue editing from the Articles list or schedule it from the calendar."
        action={
          <Link
            href={returnTo}
            className="inline-flex items-center justify-center rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink transition hover:bg-mist"
          >
            Back
          </Link>
        }
      />
      <ArticleCreateForm
        initialValues={{
          title: "",
          excerpt: "",
          coverImageUrl: "",
          contentHtml: "<h2>Article heading</h2><p>Start drafting here.</p>",
          seoTitle: "",
          seoDescription: "",
          publishedDate: initialDate
        }}
        returnTo={returnTo}
        siteId={siteId}
      />
    </section>
  );
}
