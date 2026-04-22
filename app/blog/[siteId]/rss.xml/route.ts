import { getPublicSite, getPublishedArticles } from "@/lib/articles";
import { RSSRouteParamsSchema } from "@/lib/validations";

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

function wrapCdata(value: string) {
  return "<![CDATA[" + value.replace(/]]>/g, "]]]]><![CDATA[>") + "]]>";
}

export async function GET(_request: Request, context: RouteContext) {
  const parsed = RSSRouteParamsSchema.safeParse(await context.params);

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
  const description = `Latest articles from ${site.name}`;

  const items = articles
    .map((article) => {
      const link = appUrl ? `${appUrl}/blog/${site.id}/${article.slug}` : `/blog/${site.id}/${article.slug}`;
      const title = wrapCdata(article.title);
      const excerpt = wrapCdata(article.excerpt || "");
      const pubDate = article.publishedAt ? `<pubDate>${new Date(article.publishedAt).toUTCString()}</pubDate>` : "";

      return [
        "<item>",
        `<title>${title}</title>`,
        `<link>${escapeXml(link)}</link>`,
        `<guid>${escapeXml(link)}</guid>`,
        `<description>${excerpt}</description>`,
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
    `<link>${escapeXml(blogUrl)}</link>`,
    `<description>${wrapCdata(description)}</description>`,
    items,
    "</channel>",
    "</rss>"
  ].join("");

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8"
    }
  });
}
