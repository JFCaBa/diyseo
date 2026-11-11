import { NextResponse } from "next/server";

import { formatSiteHost } from "@/lib/install-methods/site-host";
import { verifyProxy } from "@/lib/install-methods/verify-proxy";
import { prisma } from "@/lib/prisma";
import { createFixedWindowLimiter } from "@/lib/rate-limit";
import { denyUnlessSiteOwner } from "@/lib/site-access";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ siteId: string }>;
};

// The server makes an outbound request per call, so keep it slow for one site.
const allow = createFixedWindowLimiter({ limit: 6, windowMs: 60_000 });

export async function POST(_request: Request, context: RouteContext) {
  const { siteId } = await context.params;
  const denied = await denyUnlessSiteOwner(siteId);

  if (denied) {
    return denied;
  }

  if (!allow(siteId)) {
    return NextResponse.json({ ok: false, message: "Too many checks. Wait a minute and try again." }, { status: 429 });
  }

  const site = await prisma.siteProject.findUnique({
    where: { id: siteId },
    select: { domain: true, widgetInstalledAt: true }
  });

  if (!site) {
    return NextResponse.json({ error: "Site not found." }, { status: 404 });
  }

  const result = await verifyProxy(formatSiteHost(site.domain, ""), siteId);

  if (result.ok) {
    const now = new Date();

    await prisma.siteProject.update({
      where: { id: siteId },
      data: { proxyVerifiedAt: now, widgetInstalledAt: site.widgetInstalledAt ?? now }
    });
  }

  return NextResponse.json(result);
}
