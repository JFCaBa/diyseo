import Link from "next/link";

import { CreateKeywordForm } from "@/components/create-keyword-form";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type KeywordsPageProps = {
  params: Promise<{ siteId: string }>;
};

export default async function KeywordsPage({ params }: KeywordsPageProps) {
  const { siteId } = await params;
  const keywords = await prisma.keyword.findMany({
    where: { siteProjectId: siteId },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      term: true,
      status: true,
      createdAt: true
    }
  });
  const keywordCounts = keywords.reduce(
    (acc, keyword) => {
      acc.total += 1;
      if (keyword.status === "USED") {
        acc.used += 1;
      } else {
        acc.new += 1;
      }
      return acc;
    },
    { total: 0, used: 0, new: 0 }
  );

  return (
    <section className="space-y-8">
      <PageHeader
        title="Keywords"
        description="Track the topics you want to target and attach them to articles as they move through the workflow."
        action={
          <Link
            href={`/${siteId}/articles`}
            className="inline-flex items-center justify-center rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink transition hover:bg-mist"
          >
            Open Articles
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-line bg-white/90 p-5 shadow-panel">
          <p className="text-sm text-slate-500">Total Keywords</p>
          <p className="mt-2 text-3xl font-semibold text-ink">{keywordCounts.total}</p>
        </div>
        <div className="rounded-3xl border border-line bg-white/90 p-5 shadow-panel">
          <p className="text-sm text-slate-500">New</p>
          <p className="mt-2 text-3xl font-semibold text-ink">{keywordCounts.new}</p>
        </div>
        <div className="rounded-3xl border border-line bg-white/90 p-5 shadow-panel">
          <p className="text-sm text-slate-500">Used</p>
          <p className="mt-2 text-3xl font-semibold text-ink">{keywordCounts.used}</p>
        </div>
      </div>

      <CreateKeywordForm siteId={siteId} />

      <div className="rounded-3xl border border-line bg-white/85 p-6 shadow-panel">
        <div>
          <h2 className="text-lg font-semibold text-ink">Keywords</h2>
          <p className="mt-1 text-sm text-slate-600">
            Add keywords here, then assign them from the Articles screen while editing or reviewing drafts.
          </p>
        </div>
        {keywords.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-line px-4 py-6">
            <p className="text-sm text-slate-600">
              No keywords yet. You can add them manually here, or generate an article first and let AI suggest site
              keywords for you to review and assign one by one.
            </p>
            <div className="mt-4 flex flex-wrap gap-4">
              <Link href={`/${siteId}/articles`} className="text-sm font-semibold text-accent hover:underline">
                Generate your first article
              </Link>
              <span className="text-sm text-slate-500">AI-generated keywords will appear after article generation.</span>
            </div>
          </div>
        ) : (
          <div className="mt-4 grid gap-3">
            {keywords.map((keyword) => (
              <div key={keyword.id} className="flex items-center justify-between rounded-2xl border border-line px-4 py-4">
                <div>
                  <p className="font-semibold text-ink">{keyword.term}</p>
                  <p className="text-sm text-slate-600">{new Date(keyword.createdAt).toLocaleDateString()}</p>
                </div>
                <span className="rounded-full bg-mist px-3 py-1 text-xs font-semibold text-accent">
                  {keyword.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
