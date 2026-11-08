import { redirect } from "next/navigation";

import { BillingPageContent, type BillingSearchParams } from "@/components/billing-page-content";
import { StandalonePage } from "@/components/standalone-page";
import { requireWorkspace } from "@/lib/workspace-context";
import { firstSiteIdInWorkspace } from "@/lib/workspace-guards";

export const dynamic = "force-dynamic";

type BillingRedirectPageProps = { searchParams?: Promise<BillingSearchParams> };

/**
 * /billing lives inside the site layout. Stripe, the SSO upgrade flow and the
 * billing actions still link here, so this forwards their query to the first
 * site's copy of the page.
 */
export default async function BillingRedirectPage({ searchParams }: BillingRedirectPageProps) {
  const member = await requireWorkspace().catch(() => null);

  if (!member) {
    redirect("/");
  }

  const params = searchParams ? await searchParams : {};
  const siteId = await firstSiteIdInWorkspace(member.workspaceId);

  if (siteId) {
    const query = new URLSearchParams();
    for (const key of ["checkout", "error", "upgrade"] as const) {
      const value = params[key];
      if (typeof value === "string") query.set(key, value);
    }
    const suffix = query.size > 0 ? `?${query.toString()}` : "";
    redirect(`/${siteId}/billing${suffix}`);
  }

  return (
    <StandalonePage>
      <BillingPageContent searchParams={params} />
    </StandalonePage>
  );
}
