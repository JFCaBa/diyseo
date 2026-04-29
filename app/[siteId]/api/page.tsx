import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { SitePublishingApiKeysForm } from "@/components/site-publishing-api-keys-form";
import { buildPublishingApiUrl } from "@/lib/app-origin";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SiteApiPageProps = {
  params: Promise<{ siteId: string }>;
};

export default async function SiteApiPage({ params }: SiteApiPageProps) {
  const { siteId } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    notFound();
  }

  const site = await prisma.siteProject.findFirst({
    where: {
      id: siteId,
      workspace: {
        ownerId: session.user.id
      }
    },
    select: {
      id: true,
      name: true,
      publishingApiKeys: {
        orderBy: {
          createdAt: "desc"
        },
        select: {
          id: true,
          label: true,
          keyPrefix: true,
          createdAt: true,
          lastUsedAt: true,
          revokedAt: true
        }
      }
    }
  });

  if (!site) {
    notFound();
  }

  const endpointUrl = buildPublishingApiUrl(site.id);

  return (
    <section className="space-y-8">
      <PageHeader
        eyebrow="API"
        title="Publishing API"
        description="Create articles in this site from external tools using a site API key."
        action={
          <Link
            href={`/${siteId}/settings`}
            className="inline-flex items-center justify-center rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink transition hover:bg-mist"
          >
            Open Settings
          </Link>
        }
      />

      <SitePublishingApiKeysForm
        siteId={site.id}
        endpointUrl={endpointUrl}
        initialKeys={site.publishingApiKeys.map((key) => ({
          id: key.id,
          label: key.label,
          keyPrefix: key.keyPrefix,
          createdAt: key.createdAt.toISOString(),
          lastUsedAt: key.lastUsedAt ? key.lastUsedAt.toISOString() : null,
          revokedAt: key.revokedAt ? key.revokedAt.toISOString() : null
        }))}
        showDocumentation
      />
    </section>
  );
}
