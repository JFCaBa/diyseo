import { getPublicSite, getPublishedArticles } from "@/lib/articles";
import { SitemapRouteParamsSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ siteId: string }>;
};

function getAppUrl() {
  const value = process.env.NEXT_PUBLIC_APP_URL?.trim();
  return value ? value.replace(/\/$/, "") : null;
}

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
  const appUrl = getAppUrl();
  const blogUrl = appUrl ? `${appUrl}/blog/${site.id}` : `/blog/${site.id}`;

  const urls = [
    buildUrlEntry(blogUrl),
    ...articles.map((article) =>
      buildUrlEntry(
        appUrl ? `${appUrl}/blog/${site.id}/${article.slug}` : `/blog/${site.id}/${article.slug}`,
        article.publishedAt
      )
    )
  ].join("");

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    "</urlset>"
  ].join("");

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8"
    }
  });
}
