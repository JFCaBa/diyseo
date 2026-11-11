import { NextResponse } from "next/server";

import { getAppOrigin } from "@/lib/app-origin";
import { exportFingerprint } from "@/lib/install-methods/export-status";
import { buildExportZip, buildReadme, buildStaticExport, ExportError } from "@/lib/install-methods/static-export";
import { formatSiteHost, isVerifiableHost } from "@/lib/install-methods/site-host";
import { prisma } from "@/lib/prisma";
import { denyUnlessSiteOwner } from "@/lib/site-access";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type RouteContext = {
  params: Promise<{ siteId: string }>;
};

// One export at a time per site (per process): each one renders every page.
const running = new Set<string>();

export async function POST(_request: Request, context: RouteContext) {
  const { siteId } = await context.params;
  const denied = await denyUnlessSiteOwner(siteId);

  if (denied) {
    return denied;
  }

  const origin = getAppOrigin();
  // Optional: render the pages through a local address instead of the public one
  // (avoids CDN/WAF rules for self-requests and lets a CDN-less hop keep X-Forwarded-Host).
  const renderOrigin = process.env.EXPORT_RENDER_ORIGIN?.trim().replace(/\/$/, "") || origin;

  if (!origin.startsWith("https://") || !/^https?:\/\//.test(renderOrigin)) {
    return NextResponse.json({ error: "Static export needs NEXT_PUBLIC_APP_URL to be an https address." }, { status: 503 });
  }

  if (running.has(siteId)) {
    return NextResponse.json({ error: "An export is already running for this site." }, { status: 429 });
  }

  running.add(siteId);

  try {
    // The start time is what we record: anything edited while the export runs
    // is later than it and shows up as "changed since export".
    const startedAt = new Date();
    const site = await prisma.siteProject.findUnique({ where: { id: siteId }, select: { domain: true, name: true, widgetTheme: true } });

    if (!site) {
      return NextResponse.json({ error: "Site not found." }, { status: 404 });
    }

    const host = formatSiteHost(site.domain, "");

    if (!isVerifiableHost(host)) {
      return NextResponse.json({ error: "Set a valid domain for this site (for example client.com) before exporting." }, { status: 400 });
    }

    const articles = await prisma.article.findMany({
      where: { siteProjectId: siteId, status: "PUBLISHED" },
      select: { slug: true },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }]
    });

    const files = await buildStaticExport({ host, siteId, slugs: articles.map((article) => article.slug), origin, renderOrigin });
    const zip = buildExportZip({ ...files, "README.txt": buildReadme(host, startedAt) });

    await prisma.siteProject.update({
      where: { id: siteId },
      data: {
        staticExportedAt: startedAt,
        staticExportedCount: articles.length,
        staticExportedFingerprint: exportFingerprint(site)
      }
    });

    return new Response(Buffer.from(zip), {
      headers: {
        "content-type": "application/zip",
        "content-disposition": `attachment; filename="${host.replace(/[^a-z0-9.-]/gi, "_")}-blog.zip"`,
        "cache-control": "no-store"
      }
    });
  } catch (error) {
    if (error instanceof ExportError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }

    console.error("Static export failed", error);
    return NextResponse.json({ error: "The export failed. Try again." }, { status: 500 });
  } finally {
    running.delete(siteId);
  }
}
