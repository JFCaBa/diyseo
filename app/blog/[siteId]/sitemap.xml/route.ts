import { getPublicSite, getPublishedArticles } from "@/lib/articles";
import { getPublicUrls } from "@/lib/public-urls";
import { SitemapRouteParamsSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ siteId: string }>;
};

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

export async function GET(_request: Request, context: RouteContext) {
  const parsed = SitemapRouteParamsSchema.safeParse(await context.params);

  if (!parsed.success) {
    return new Response("Site not found", { status: 404 });
  }

  const site = await getPublicSite(parsed.data.siteId);

  if (!site) {
    return new Response("Site not found", { status: 404 });
  }

  const articles = await getPublishedArticles(parsed.data.siteId);
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
    headers: {
      "Content-Type": "application/xml; charset=utf-8"
    }
  });
}
