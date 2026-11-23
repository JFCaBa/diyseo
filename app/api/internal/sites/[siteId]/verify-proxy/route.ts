import { NextResponse } from "next/server";

import { getT } from "@/lib/i18n/server";
import { localizeProxyResult } from "@/lib/install-methods/localize";
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

  const t = await getT();

  if (!allow(siteId)) {
    return NextResponse.json({ ok: false, message: t("install.verifyResult.tooManyChecks") }, { status: 429 });
  }

  const site = await prisma.siteProject.findUnique({
    where: { id: siteId },
    select: { domain: true, widgetInstalledAt: true }
  });

  if (!site) {
    return NextResponse.json({ error: t("install.verifyResult.siteNotFound") }, { status: 404 });
  }

  const host = formatSiteHost(site.domain, "");
  const result = await verifyProxy(host, siteId);

  if (result.ok) {
    const now = new Date();

    await prisma.siteProject.update({
      where: { id: siteId },
      data: { proxyVerifiedAt: now, widgetInstalledAt: site.widgetInstalledAt ?? now }
    });
  }

  const message = localizeProxyResult(t, result, host);

  // `status` only feeds the localized text; the response keeps its original shape.
  return NextResponse.json(result.ok ? { ok: true, message } : { ok: false, reason: result.reason, message });
}
