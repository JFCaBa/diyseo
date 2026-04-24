import Link from "next/link";
import { redirect } from "next/navigation";

import { SignOutButton } from "@/components/auth-buttons";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SiteTransferForm } from "@/components/site-transfer-form";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatDisplayDomain(value: string) {
  try {
    return new URL(value).host.replace(/\/$/, "");
  } catch {
    return value.replace(/^https?:\/\//, "").replace(/\/$/, "");
  }
}

export default async function SettingsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/");
  }

  const workspace = await prisma.workspace.findUnique({
    where: { ownerId: session.user.id },
    include: {
      sites: {
        orderBy: { createdAt: "asc" }
      }
    }
  });

  const sites = workspace?.sites ?? [];

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="border-b border-line bg-white p-6 dark:border-slate-800 dark:bg-slate-900 lg:border-b-0 lg:border-r">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent">DIYSEO</p>
          <h1 className="mt-2 text-xl font-semibold text-ink dark:text-slate-100">{workspace?.name ?? "My Workspace"}</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Workspace settings and site ownership</p>
        </div>

        <nav className="space-y-2">
          <Link
            href="/settings"
            className="flex items-center rounded-2xl bg-slate-50 px-4 py-3 text-sm font-medium text-ink shadow-sm transition hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-100"
          >
            Settings
          </Link>
          {sites.map((site) => (
            <Link
              key={site.id}
              href={`/${site.id}`}
              title={site.domain}
              className="flex items-center rounded-2xl px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-ink dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              <span className="truncate">{site.name}</span>
            </Link>
          ))}
        </nav>
      </aside>

      <div className="flex min-h-screen flex-col">
        <header className="border-b border-line bg-white/70 px-6 py-4 backdrop-blur">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Self-hosted SEO workspace</p>
              <p className="text-lg font-semibold text-ink">Managing workspace sites and ownership</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/new-site"
                className="inline-flex items-center justify-center rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink shadow-sm transition hover:bg-mist"
              >
                Add Website
              </Link>
              <SignOutButton />
            </div>
          </div>
        </header>

        <main className="flex-1 px-6 py-8">
          <section className="space-y-8">
            <PageHeader
              title="Settings"
              description="Manage your workspace and the websites inside it. Each site keeps its own Brand DNA, content workflow, analytics, and public blog identity."
            />

            <section className="rounded-3xl border border-line bg-white/90 p-6 shadow-panel">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Workspace</p>
                  <h2 className="mt-2 text-2xl font-semibold text-ink">{workspace?.name ?? "My Workspace"}</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Open a site, transfer ownership when needed, or add another website without leaving the admin shell.
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
                          <p
                            title={site.domain}
                            className="min-w-0 truncate text-sm text-slate-600"
                          >
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
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </section>
        </main>
      </div>
    </div>
  );
}
