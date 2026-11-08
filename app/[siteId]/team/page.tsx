import { TeamPageContent } from "@/components/team-page-content";
import { requireSitePage } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";

export default async function SiteTeamPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  await requireSitePage(siteId);

  return <TeamPageContent />;
}
