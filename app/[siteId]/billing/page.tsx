import { BillingPageContent, type BillingSearchParams } from "@/components/billing-page-content";
import { requireSitePage } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";

type SiteBillingPageProps = {
  params: Promise<{ siteId: string }>;
  searchParams?: Promise<BillingSearchParams>;
};

export default async function SiteBillingPage({ params, searchParams }: SiteBillingPageProps) {
  const { siteId } = await params;
  await requireSitePage(siteId);

  return <BillingPageContent searchParams={searchParams ? await searchParams : undefined} />;
}
