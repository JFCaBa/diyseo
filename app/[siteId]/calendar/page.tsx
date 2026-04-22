import Link from "next/link";

import { CalendarMonthView } from "@/components/calendar-month-view";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type CalendarPageProps = {
  params: Promise<{ siteId: string }>;
  searchParams: Promise<{ month?: string }>;
};

function getMonthStart(value?: string) {
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    const [year, month] = value.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, 1));
  }

  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export default async function CalendarPage({ params, searchParams }: CalendarPageProps) {
  const { siteId } = await params;
  const query = await searchParams;
  const monthStart = getMonthStart(query.month);
  const nextMonthStart = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1));
  const articles = await prisma.article.findMany({
    where: {
      siteProjectId: siteId,
      publishedAt: {
        gte: monthStart,
        lt: nextMonthStart
      }
    },
    orderBy: [{ publishedAt: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      title: true,
      status: true,
      publishedAt: true
    }
  });

  return (
    <section className="space-y-8">
      <PageHeader
        title="Calendar"
        description="Plan the publishing cadence for this site, reschedule content, and create drafts directly from open dates."
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/${siteId}/articles`}
              className="inline-flex items-center justify-center rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink transition hover:bg-mist"
            >
              Open Articles
            </Link>
            <Link
              href={`/${siteId}/articles/new?returnTo=${encodeURIComponent(`/${siteId}/calendar`)}`}
              className="inline-flex items-center justify-center rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              New Draft
            </Link>
          </div>
        }
      />
      <CalendarMonthView
        articles={articles.filter((article) => article.publishedAt).map((article) => ({ ...article, publishedAt: article.publishedAt! }))}
        month={monthStart}
        returnToBase={`/${siteId}/calendar`}
        siteId={siteId}
      />
    </section>
  );
}
