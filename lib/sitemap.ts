import { XML_HEAD } from "@/lib/landing/sitemap";

/** The root sitemap index: the landing sitemap, then one blog sitemap per site. */
export function sitemapIndexXml(appUrl: string, sites: { id: string; updatedAt: Date }[]): string {
  const entries = [
    `<sitemap><loc>${appUrl}/sitemap-pages.xml</loc></sitemap>`,
    ...sites.map(
      (site) => `<sitemap><loc>${appUrl}/blog/${site.id}/sitemap.xml</loc><lastmod>${site.updatedAt.toISOString()}</lastmod></sitemap>`
    )
  ].join("");

  return [XML_HEAD, '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">', entries, "</sitemapindex>"].join("");
}
