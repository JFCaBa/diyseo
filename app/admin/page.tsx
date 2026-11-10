import Link from "next/link";

import { requireAdmin } from "@/lib/admin-auth";
import { formatClock } from "@/lib/admin-format";
import { TRIALS_ENDING_DAYS, countByEffectivePlan, trialEndingWindow } from "@/lib/admin-metrics";
import { estimateMonthlyFromPlans, formatMinor } from "@/lib/admin-revenue";
import { getMonthRevenue } from "@/lib/admin-stripe";
import { monthStartUtc } from "@/lib/entitlements";
import { prisma } from "@/lib/prisma";

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

export default async function AdminPage() {
  await requireAdmin();

  const now = new Date();
  const window = trialEndingWindow(now);

  const [revenue, workspacePlans, newUsersThisMonth, endingTrials, totalUsers, totalSites, totalArticles, totalKeywords, connectedSearchConsoleSites, articleStatusCounts, newestSites, endingTrialsTotal] =
    await Promise.all([
      getMonthRevenue(now),
      prisma.workspace.findMany({ select: { plan: true, trialEndsAt: true } }),
      prisma.user.count({
        where: { workspace: { isNot: null }, createdAt: { gte: monthStartUtc(now) } }
      }),
      prisma.workspace.findMany({
        where: { plan: "TRIAL", trialEndsAt: { gt: window.from, lte: window.to } },
        orderBy: { trialEndsAt: "asc" },
        take: 20,
        select: { id: true, trialEndsAt: true, owner: { select: { id: true, email: true } } }
      }),
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
      }),
      prisma.workspace.count({ where: { plan: "TRIAL", trialEndsAt: { gt: window.from, lte: window.to } } })
    ]);

  const publishedArticles = articleStatusCounts.find((item) => item.status === "PUBLISHED")?._count.id ?? 0;
  const draftArticles = articleStatusCounts.find((item) => item.status === "DRAFT")?._count.id ?? 0;
  const articleMix = totalArticles > 0 ? Math.round((publishedArticles / totalArticles) * 100) : 0;

  const planEstimate = estimateMonthlyFromPlans(countByEffectivePlan(workspacePlans, now));

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

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-2xl">
          <p className="text-sm text-slate-400">Charges this month, net of refunds on them</p>
          {revenue.ok ? (
            revenue.totals.length > 0 ? (
              revenue.totals.map((t) => (
                <p key={t.currency} className="mt-3 text-3xl font-semibold text-white">
                  {formatMinor(t.amountMinor, t.currency)}
                </p>
              ))
            ) : (
              <p className="mt-3 text-3xl font-semibold text-white">{formatMinor(0, "GBP")}</p>
            )
          ) : (
            <p className="mt-3 text-3xl font-semibold text-slate-400">Stripe unavailable</p>
          )}
          {revenue.ok ? <p className="mt-3 text-xs text-slate-500">Updated {formatClock(revenue.fetchedAt)}</p> : null}
          <p className="mt-3 text-sm text-slate-500">Estimate from plans: {formatMinor(planEstimate * 100, "GBP")}</p>
        </div>
        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-2xl">
          <p className="text-sm text-slate-400">New users this month</p>
          <p className="mt-3 text-3xl font-semibold text-white">{formatCount(newUsersThisMonth)}</p>
        </div>
        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-2xl">
          <p className="text-sm text-slate-400">Trials ending in {TRIALS_ENDING_DAYS} days</p>
          <p className="mt-3 text-3xl font-semibold text-white">{formatCount(endingTrialsTotal)}</p>
          <ul className="mt-3 space-y-1 text-sm">
            {endingTrials.map((ws) => (
              <li key={ws.id} className="flex justify-between gap-3">
                <Link href={`/admin/users/${ws.owner.id}`} className="truncate text-teal-400 hover:underline">
                  {ws.owner.email ?? ws.owner.id}
                </Link>
                <span className="shrink-0 text-slate-500">{ws.trialEndsAt?.toISOString().slice(0, 10)}</span>
              </li>
            ))}
          </ul>
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
