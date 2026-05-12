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

  const entries = sites
    .map(
      (site) =>
        `<sitemap><loc>${appUrl}/blog/${site.id}/sitemap.xml</loc><lastmod>${site.updatedAt.toISOString()}</lastmod></sitemap>`
    )
    .join("");

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    entries,
    "</sitemapindex>"
  ].join("");

  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" }
  });
}
