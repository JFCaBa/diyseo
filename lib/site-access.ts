import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { findSiteInWorkspace } from "@/lib/workspace-guards";

/**
 * Guard for admin JSON routes under /api/internal/sites. middleware.ts lets that
 * prefix through without a session (the publishing API under it authenticates
 * with API keys), so every other route there must check the caller itself.
 * Returns a response to send back when access is denied, or null when the
 * site belongs to the signed-in user's workspace.
 */
export async function denyUnlessSiteOwner(siteId: string): Promise<NextResponse | null> {
  const session = await auth();

  const workspaceId = session?.user?.workspaceId;

  if (!session?.user?.id || !workspaceId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const site = await findSiteInWorkspace(siteId, workspaceId);

  return site ? null : NextResponse.json({ error: "Site not found." }, { status: 404 });
}
