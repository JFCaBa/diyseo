import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { firstSiteIdInWorkspace } from "@/lib/workspace-guards";

export const dynamic = "force-dynamic";

export default async function SettingsRedirectPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/");
  }

  const firstSiteId = await firstSiteIdInWorkspace(session.user.workspaceId);

  redirect(firstSiteId ? `/${firstSiteId}/settings` : "/new-site");
}
