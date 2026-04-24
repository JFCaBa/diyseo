import { headers } from "next/headers";

import { getSiteByHost, getPublishedArticles } from "@/lib/articles";
import { getPublicUrls } from "@/lib/public-urls";

export const dynamic = "force-dynamic";

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildUrlEntry(loc: string, lastModified?: Date | string | null) {
  return [
    "<url>",
    `<loc>${escapeXml(loc)}</loc>`,
    lastModified ? `<lastmod>${new Date(lastModified).toISOString()}</lastmod>` : "",
    "</url>"
  ]
    .filter(Boolean)
    .join("");
}

export async function GET() {
  const h = await headers();
  const host = h.get("x-forwarded-host");

  if (!host) {
    return new Response("Not found", { status: 404 });
  }

  const site = await getSiteByHost(host);

  if (!site) {
    return new Response("Site not found", { status: 404 });
  }

  const articles = await getPublishedArticles(site.id);
  const urls = await getPublicUrls(site.id);

  const entries = [
    buildUrlEntry(urls.indexUrl),
    ...articles.map((article) => buildUrlEntry(urls.articleUrl(article.slug), article.publishedAt))
  ].join("");

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    entries,
    "</urlset>"
  ].join("");

  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" }
  });
}
