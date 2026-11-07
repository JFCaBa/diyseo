import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Guard for admin JSON routes under /api/internal/sites. middleware.ts lets that
 * prefix through without a session (the publishing API under it authenticates
 * with API keys), so every other route there must check the caller itself.
 * Returns a response to send back when access is denied, or null when the
 * signed-in user owns the site.
 */
export async function denyUnlessSiteOwner(siteId: string): Promise<NextResponse | null> {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const site = await prisma.siteProject.findFirst({
    where: { id: siteId, workspace: { ownerId: session.user.id } },
    select: { id: true }
  });

  return site ? null : NextResponse.json({ error: "Site not found." }, { status: 404 });
}
