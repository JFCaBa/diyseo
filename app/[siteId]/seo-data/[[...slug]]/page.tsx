import { SatellitePage } from "@/components/satellite-page";
import { requireSitePage } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";

export default async function SiteSeoDataPage({ params }: { params: Promise<{ siteId: string; slug?: string[] }> }) {
  const { siteId, slug } = await params;
  const member = await requireSitePage(siteId);
  return <SatellitePage siteId={siteId} member={member} service="mcp" slug={slug} />;
}
