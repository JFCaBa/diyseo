import { UI_LOCALES } from "@/lib/i18n/locale";
import { LANDING_PATH } from "@/lib/landing/copy";

export const XML_HEAD = '<?xml version="1.0" encoding="UTF-8"?>';

/** Every landing (`/`, `/es`, `/pt`), each carrying the full hreflang set (same pairs as the pages' own alternates). */
export function landingSitemapXml(appUrl: string): string {
  const url = (path: string) => `${appUrl}${path}`;
  const alternates = [...UI_LOCALES.map((l) => [l, LANDING_PATH[l]]), ["x-default", LANDING_PATH.en]]
    .map(([lang, path]) => `<xhtml:link rel="alternate" hreflang="${lang}" href="${url(path)}"/>`)
    .join("");
  const entries = UI_LOCALES.map((l) => LANDING_PATH[l]).map((path) => `<url><loc>${url(path)}</loc>${alternates}</url>`).join("");

  return [
    XML_HEAD,
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    entries,
    "</urlset>"
  ].join("");
}
