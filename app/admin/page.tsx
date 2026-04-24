import Link from "next/link";

import { AdminPasswordForm } from "@/components/admin-password-form";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export default async function AdminPage() {
  const authenticated = await isAdminAuthenticated();
  const isConfigured = Boolean(process.env.ADMIN_PASSWORD?.trim());

  if (!authenticated) {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md items-center justify-center">
        <AdminPasswordForm isConfigured={isConfigured} />
      </div>
    );
  }

  const [totalUsers, totalSites, totalArticles, totalKeywords, connectedSearchConsoleSites, articleStatusCounts, newestSites] =
    await Promise.all([
      prisma.user.count(),
      prisma.siteProject.count(),
      prisma.article.count(),
      prisma.keyword.count(),
      prisma.siteProject.count({
        where: {
          searchConsolePropertyUrl: {
            not: null
          }
        }
      }),
      prisma.article.groupBy({
        by: ["status"],
        _count: {
          id: true
        }
      }),
      prisma.siteProject.findMany({
        orderBy: {
          createdAt: "desc"
        },
        take: 5,
        select: {
          id: true,
          name: true,
          domain: true,
          _count: {
            select: {
              articles: true
            }
          }
        }
      })
    ]);

  const publishedArticles = articleStatusCounts.find((item) => item.status === "PUBLISHED")?._count.id ?? 0;
  const draftArticles = articleStatusCounts.find((item) => item.status === "DRAFT")?._count.id ?? 0;
  const articleMix = totalArticles > 0 ? Math.round((publishedArticles / totalArticles) * 100) : 0;

  const cards = [
    { label: "Total users", value: totalUsers },
    { label: "Total sites", value: totalSites },
    { label: "Total articles", value: totalArticles },
    { label: "Published articles", value: publishedArticles },
    { label: "Draft articles", value: draftArticles },
    { label: "Total keywords", value: totalKeywords },
    { label: "Connected GSC sites", value: connectedSearchConsoleSites }
  ];

  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-3 border-b border-slate-800 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-400">Platform</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Admin dashboard</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-400">
            Real platform-wide counts for users, sites, content, keywords, and Search Console connections.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-2xl">
            <p className="text-sm text-slate-400">{card.label}</p>
            <p className="mt-3 text-3xl font-semibold text-white">{formatCount(card.value)}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Article status mix</h2>
              <p className="mt-1 text-sm text-slate-400">Published vs draft content across the whole platform.</p>
            </div>
            <Link href="/admin/content" className="text-sm font-semibold text-teal-400 hover:underline">
              View content
            </Link>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="flex items-center justify-between text-sm text-slate-400">
              <span>Published</span>
              <span>{articleMix}%</span>
            </div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-teal-400" style={{ width: `${articleMix}%` }} />
            </div>
            <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
              <span>{formatCount(publishedArticles)} published</span>
              <span>{formatCount(draftArticles)} draft</span>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Newest sites</h2>
              <p className="mt-1 text-sm text-slate-400">Recently created sites and how much content they have.</p>
            </div>
            <Link href="/admin/sites" className="text-sm font-semibold text-teal-400 hover:underline">
              View sites
            </Link>
          </div>

          <div className="mt-6 grid gap-3">
            {newestSites.map((site) => (
              <div key={site.id} className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-4">
                <p className="font-semibold text-white">{site.name}</p>
                <p className="mt-1 truncate text-sm text-slate-400">{site.domain}</p>
                <p className="mt-2 text-sm text-slate-500">{formatCount(site._count.articles)} articles</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
