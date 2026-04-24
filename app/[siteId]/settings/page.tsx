import Link from "next/link";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SiteAutoPublishForm } from "@/components/site-auto-publish-form";
import { SiteDeleteForm } from "@/components/site-delete-form";
import { SiteTransferForm } from "@/components/site-transfer-form";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SiteSettingsPageProps = {
  params: Promise<{ siteId: string }>;
};

function formatDisplayDomain(value: string) {
  try {
    return new URL(value).host.replace(/\/$/, "");
  } catch {
    return value.replace(/^https?:\/\//, "").replace(/\/$/, "");
  }
}

export default async function SiteSettingsPage({ params }: SiteSettingsPageProps) {
  const { siteId } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    notFound();
  }

  const [currentSite, workspace] = await Promise.all([
    prisma.siteProject.findFirst({
      where: {
        id: siteId,
        workspace: {
          ownerId: session.user.id
        }
      },
      select: {
        id: true,
        autoPublishEnabled: true,
        articlesPerWeek: true,
        requireReview: true
      }
    }),
    prisma.workspace.findUnique({
      where: { ownerId: session.user.id },
      include: {
        sites: {
          orderBy: { createdAt: "asc" }
        }
      }
    })
  ]);

  if (!currentSite) {
    notFound();
  }

  const sites = workspace?.sites ?? [];

  return (
    <section className="space-y-8">
      <PageHeader
        title="Settings"
        description="Manage your workspace sites, ownership transfers, and add new websites without leaving the normal admin shell."
        action={
          <Link
            href="/new-site"
            className="inline-flex items-center justify-center rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink transition hover:bg-mist"
          >
            Add Website
          </Link>
        }
      />

      <section className="rounded-3xl border border-line bg-white/90 p-6 shadow-panel">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Workspace</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">{workspace?.name ?? "My Workspace"}</h2>
            <p className="mt-2 text-sm text-slate-600">
              Open a site, transfer ownership when needed, or add another website. Public site identity and existing
              embeds stay unchanged after transfer.
            </p>
          </div>
          <Link
            href="/new-site"
            className="inline-flex items-center justify-center rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink transition hover:bg-mist"
          >
            Add Website
          </Link>
        </div>

        {sites.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              title="No sites yet"
              description="Create your first site to unlock onboarding, Brand DNA, article workflows, analytics, and the public blog."
              action={
                <Link
                  href="/new-site"
                  className="inline-flex items-center justify-center rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Add Website
                </Link>
              }
            />
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-line">
            <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] gap-3 bg-mist px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <p>Site</p>
              <p>Domain</p>
              <p className="text-right">Actions</p>
            </div>
            <div className="divide-y divide-line">
              {sites.map((site) => (
                <div key={site.id} className="px-4 py-4">
                  <div className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] md:items-center">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">{site.name}</p>
                    </div>
                    <p title={site.domain} className="min-w-0 truncate text-sm text-slate-600">
                      {formatDisplayDomain(site.domain)}
                    </p>
                    <div className="flex flex-wrap items-center justify-start gap-2 md:justify-end">
                      <Link
                        href={`/${site.id}`}
                        className="inline-flex items-center justify-center rounded-2xl border border-line px-4 py-2 text-sm font-medium text-accent transition hover:bg-mist"
                      >
                        Open site
                      </Link>
                      <SiteTransferForm siteId={site.id} />
                      <SiteDeleteForm siteId={site.id} siteName={site.name} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <SiteAutoPublishForm
        siteId={currentSite.id}
        initialAutoPublishEnabled={currentSite.autoPublishEnabled}
        initialArticlesPerWeek={currentSite.articlesPerWeek}
        initialRequireReview={currentSite.requireReview}
      />
    </section>
  );
}
