import { redirect } from "next/navigation";

import { StandalonePage } from "@/components/standalone-page";
import { TeamPageContent } from "@/components/team-page-content";
import { requireWorkspace } from "@/lib/workspace-context";
import { firstSiteIdInWorkspace } from "@/lib/workspace-guards";

export const dynamic = "force-dynamic";

/** /team lives inside the site layout; this sends the caller to their first site's copy of it. */
export default async function TeamRedirectPage() {
  const member = await requireWorkspace().catch(() => null);

  if (!member) {
    redirect("/");
  }

  const siteId = await firstSiteIdInWorkspace(member.workspaceId);

  if (siteId) {
    redirect(`/${siteId}/team`);
  }

  return (
    <StandalonePage>
      <TeamPageContent />
    </StandalonePage>
  );
}
