import Link from "next/link";
import { notFound } from "next/navigation";
import { type ReactNode } from "react";

import { SidebarNav } from "@/components/sidebar-nav";
import { SiteSelector } from "@/components/site-selector";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SiteLayoutProps = {
  children: ReactNode;
  params: Promise<{ siteId: string }>;
};

export default async function SiteLayout({ children, params }: SiteLayoutProps) {
  const { siteId } = await params;

  const [currentSite, sites] = await Promise.all([
    prisma.siteProject.findUnique({
      where: { id: siteId },
      select: { id: true, name: true, domain: true }
    }),
    prisma.siteProject.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true }
    })
  ]);

  if (!currentSite) {
    notFound();
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="border-b border-line bg-sand/90 p-6 lg:border-b-0 lg:border-r">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent">DIYSEO</p>
          <h1 className="mt-2 text-xl font-semibold text-ink">{currentSite.name}</h1>
          <p className="mt-1 text-sm text-slate-600">{currentSite.domain}</p>
        </div>
        <SidebarNav siteId={siteId} />
      </aside>

      <div className="flex min-h-screen flex-col">
        <header className="border-b border-line bg-white/70 px-6 py-4 backdrop-blur">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Self-hosted SEO workspace</p>
              <p className="text-lg font-semibold text-ink">Managing {currentSite.name}</p>
            </div>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="flex items-center gap-3">
                <Link
                  href={`/blog/${siteId}`}
                  className="inline-flex items-center justify-center rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink shadow-sm transition hover:bg-mist"
                >
                  View Blog
                </Link>
                <Link
                  href={`/${siteId}/articles/new`}
                  className="inline-flex items-center justify-center rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                >
                  New Article
                </Link>
              </div>
              <SiteSelector currentSiteId={siteId} sites={sites} />
            </div>
          </div>
        </header>
        <main className="flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
