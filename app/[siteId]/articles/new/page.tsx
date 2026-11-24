import Link from "next/link";

import { ArticleCreateForm } from "@/components/article-create-form";
import { PageHeader } from "@/components/page-header";
import { getT } from "@/lib/i18n/server";
import { requireSitePage } from "@/lib/workspace-context";

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
  await requireSitePage(siteId);
  const t = await getT();
  const query = await searchParams;
  const initialDate = getInitialDate(query.date);
  const returnTo = query.returnTo || `/${siteId}/calendar`;

  return (
    <section className="space-y-8">
      <PageHeader
        title={t("articles.newTitle")}
        description={t("articles.newDescription")}
        action={
          <Link
            href={returnTo}
            className="inline-flex items-center justify-center rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink transition hover:bg-mist"
          >
            {t("articles.back")}
          </Link>
        }
      />
      <ArticleCreateForm
        initialValues={{
          title: "",
          excerpt: "",
          coverImageUrl: "",
          contentMarkdown: "## Article heading\n\nStart drafting here.",
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
