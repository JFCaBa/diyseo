import Link from "next/link";
import { redirect } from "next/navigation";

import { SignOutButton } from "@/components/auth-buttons";
import { CreateSiteForm } from "@/components/create-site-form";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SiteTransferForm } from "@/components/site-transfer-form";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

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
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-10">
      <PageHeader
        title="Settings"
        description="Manage your workspace and the websites inside it. Each site gets its own Brand DNA, content workflow, analytics, and public blog."
        action={
          <div className="flex items-center gap-3">
            <Link
              href="/new-site"
              className="inline-flex items-center justify-center rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink transition hover:bg-mist"
            >
              Add Website
            </Link>
            <SignOutButton />
          </div>
        }
      />

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-4 rounded-3xl border border-line bg-white/85 p-6 shadow-panel">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Workspace</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">{workspace?.name ?? "My Workspace"}</h2>
          </div>

          {sites.length === 0 ? (
            <EmptyState
              title="No sites yet"
              description="Create your first site to unlock onboarding, Brand DNA, article workflows, analytics, and the public blog."
            />
          ) : (
            <div className="grid gap-3">
              {sites.map((site) => (
                <div key={site.id} className="rounded-2xl border border-line px-4 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-ink">{site.name}</h3>
                      <p className="text-sm text-slate-600">{site.domain}</p>
                    </div>
                    <Link
                      href={`/${site.id}`}
                      className="inline-flex shrink-0 rounded-2xl border border-line px-4 py-2 text-sm font-medium text-accent transition hover:bg-mist"
                    >
                      Open site
                    </Link>
                  </div>
                  <SiteTransferForm siteId={site.id} />
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Create Site</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">Add a Website</h2>
          </div>
          <CreateSiteForm />
        </section>
      </div>
    </main>
  );
}
