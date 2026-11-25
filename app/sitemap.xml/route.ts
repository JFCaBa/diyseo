import { sitemapIndexXml } from "@/lib/sitemap";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function getAppUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
}

export async function GET() {
  const appUrl = getAppUrl();

  if (!appUrl) {
    return new Response("NEXT_PUBLIC_APP_URL is not configured", { status: 500 });
  }

  const sites = await prisma.siteProject.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, updatedAt: true }
  });

  const xml = sitemapIndexXml(appUrl, sites);

  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" }
  });
}
