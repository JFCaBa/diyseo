import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { type ReactNode } from "react";

import { SignOutButton } from "@/components/auth-buttons";
import { BlogOnly } from "@/components/blog-only";
import { SidebarNav } from "@/components/sidebar-nav";
import { SiteSelector } from "@/components/site-selector";
import { auth } from "@/lib/auth";
import { effectivePlan } from "@/lib/entitlements";
import { prisma } from "@/lib/prisma";
import { satelliteGrant } from "@/lib/satellite-entitlements";
import { satelliteGroups } from "@/lib/sso/satellite-links";

export const dynamic = "force-dynamic";

type SiteLayoutProps = {
  children: ReactNode;
  params: Promise<{ siteId: string }>;
};

export default async function SiteLayout({ children, params }: SiteLayoutProps) {
  const { siteId } = await params;
  const session = await auth();

  const workspaceId = session?.user?.workspaceId;

  if (!session?.user?.id || !workspaceId) {
    redirect("/");
  }

  const [currentSite, sites, workspace, membership] = await Promise.all([
    prisma.siteProject.findFirst({
      where: { id: siteId, workspaceId },
      select: { id: true, name: true }
    }),
    prisma.siteProject.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true }
    }),
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { plan: true, trialEndsAt: true }
    }),
    prisma.workspaceMember.findUnique({
      where: { userId: session.user.id },
      select: { role: true, workspaceId: true }
    })
  ]);

  if (!currentSite) {
    notFound();
  }

  const isOwner = membership?.workspaceId === workspaceId && membership.role === "OWNER";
  const satellites = workspace ? satelliteGroups(satelliteGrant(effectivePlan(workspace, new Date())), isOwner) : [];

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="border-b border-line bg-white p-6 dark:border-slate-800 dark:bg-slate-900 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent">DIYSEO</p>
        </div>
        <SidebarNav siteId={siteId} satellites={satellites} />
        <div className="mt-6 border-t border-line pt-6 dark:border-slate-800">
          <SignOutButton className="flex w-full items-center rounded-2xl px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-ink dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100" />
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-col">
        <BlogOnly siteId={siteId}>
        <header className="border-b border-line bg-white/70 px-6 py-4 backdrop-blur">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Self-hosted SEO workspace</p>
              <p className="text-lg font-semibold text-ink">Managing {currentSite.name}</p>
            </div>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="flex items-center gap-3">
                <Link
                  href={`/${siteId}/preview`}
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
        </BlogOnly>
        <main className="min-w-0 flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
