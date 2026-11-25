import { LANDING_PATH } from "@/lib/landing/copy";

export const XML_HEAD = '<?xml version="1.0" encoding="UTF-8"?>';

/** `/` and `/es`, each carrying the full hreflang set (same pairs as the pages' own alternates). */
export function landingSitemapXml(appUrl: string): string {
  const url = (path: string) => `${appUrl}${path}`;
  const alternates = [
    ["en", LANDING_PATH.en],
    ["es", LANDING_PATH.es],
    ["x-default", LANDING_PATH.en]
  ]
    .map(([lang, path]) => `<xhtml:link rel="alternate" hreflang="${lang}" href="${url(path)}"/>`)
    .join("");
  const entries = [LANDING_PATH.en, LANDING_PATH.es].map((path) => `<url><loc>${url(path)}</loc>${alternates}</url>`).join("");

  return [
    XML_HEAD,
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    entries,
    "</urlset>"
  ].join("");
}
