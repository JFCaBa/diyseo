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

function wrapCdata(value: string) {
  return "<![CDATA[" + value.replace(/]]>/g, "]]]]><![CDATA[>") + "]]>";
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
  const feedUpdated = articles[0]?.updatedAt
    ? new Date(articles[0].updatedAt).toISOString()
    : new Date().toISOString();

  const entries = articles
    .map((article) => {
      const link = urls.articleUrl(article.slug);
      const updated = new Date(article.updatedAt).toISOString();
      const published = article.publishedAt ? new Date(article.publishedAt).toISOString() : updated;

      return [
        "<entry>",
        `<title>${wrapCdata(article.title)}</title>`,
        `<link href="${escapeXml(link)}" />`,
        `<id>${escapeXml(link)}</id>`,
        `<updated>${updated}</updated>`,
        `<published>${published}</published>`,
        `<summary>${wrapCdata(article.excerpt || "")}</summary>`,
        "</entry>"
      ].join("");
    })
    .join("");

  const xml = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    `<title>${wrapCdata(`${site.name} Blog`)}</title>`,
    `<link href="${escapeXml(urls.atomUrl)}" rel="self" />`,
    `<link href="${escapeXml(urls.indexUrl)}" />`,
    `<updated>${feedUpdated}</updated>`,
    `<id>${escapeXml(urls.indexUrl)}</id>`,
    "<author>",
    `<name>${wrapCdata(site.name)}</name>`,
    "</author>",
    entries,
    "</feed>"
  ].join("");

  return new Response(xml, {
    headers: { "Content-Type": "application/atom+xml; charset=utf-8" }
  });
}
