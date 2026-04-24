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
  const description = `Latest articles from ${site.name}`;

  const items = articles
    .map((article) => {
      const link = urls.articleUrl(article.slug);
      const pubDate = article.publishedAt ? `<pubDate>${new Date(article.publishedAt).toUTCString()}</pubDate>` : "";

      return [
        "<item>",
        `<title>${wrapCdata(article.title)}</title>`,
        `<link>${escapeXml(link)}</link>`,
        `<guid>${escapeXml(link)}</guid>`,
        `<description>${wrapCdata(article.excerpt || "")}</description>`,
        pubDate,
        "</item>"
      ]
        .filter(Boolean)
        .join("");
    })
    .join("");

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    "<channel>",
    `<title>${wrapCdata(`${site.name} Blog`)}</title>`,
    `<link>${escapeXml(urls.indexUrl)}</link>`,
    `<description>${wrapCdata(description)}</description>`,
    items,
    "</channel>",
    "</rss>"
  ].join("");

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" }
  });
}
