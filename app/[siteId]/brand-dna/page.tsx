import Link from "next/link";

import { BrandDNAForm } from "@/components/brand-dna-form";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type BrandDNAPageProps = {
  params: Promise<{ siteId: string }>;
};

export default async function BrandDNAPage({ params }: BrandDNAPageProps) {
  const { siteId } = await params;

  const site = await prisma.siteProject.findUnique({
    where: { id: siteId },
    include: { brandProfile: true }
  });

  if (!site) {
    return null;
  }

  return (
    <section className="space-y-8">
      <PageHeader
        title="Brand DNA"
        description="Define the voice, audience, themes, and image direction that should shape every generated or manually edited article."
        action={
          <Link
            href={`/${siteId}/articles`}
            className="inline-flex items-center justify-center rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink transition hover:bg-mist"
          >
            Open Articles
          </Link>
        }
      />

      <BrandDNAForm
        siteId={siteId}
        initialValues={{
          contentLanguage: site.brandProfile?.contentLanguage,
          businessType: site.brandProfile?.businessType,
          brandVoiceTone: site.brandProfile?.brandVoiceTone,
          targetAudience: site.brandProfile?.targetAudience,
          serviceArea: site.brandProfile?.serviceArea,
          topicsToAvoid: site.brandProfile?.topicsToAvoid,
          keyThemes: site.brandProfile?.keyThemes,
          customImageInstructions: site.brandProfile?.customImageInstructions,
          imageStyle: site.brandProfile?.imageStyle
        }}
      />
    </section>
  );
}
