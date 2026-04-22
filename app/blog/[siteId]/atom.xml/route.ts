import { getPublicSite, getPublishedArticles } from "@/lib/articles";
import { AtomRouteParamsSchema } from "@/lib/validations";

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
  const parsed = AtomRouteParamsSchema.safeParse(await context.params);

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
  const selfUrl = appUrl ? `${appUrl}/blog/${site.id}/atom.xml` : `/blog/${site.id}/atom.xml`;
  const feedUpdated = articles[0]?.updatedAt
    ? new Date(articles[0].updatedAt).toISOString()
    : new Date().toISOString();

  const entries = articles
    .map((article) => {
      const link = appUrl ? `${appUrl}/blog/${site.id}/${article.slug}` : `/blog/${site.id}/${article.slug}`;
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
    `<link href="${escapeXml(selfUrl)}" rel="self" />`,
    `<link href="${escapeXml(blogUrl)}" />`,
    `<updated>${feedUpdated}</updated>`,
    `<id>${escapeXml(blogUrl)}</id>`,
    "<author>",
    `<name>${wrapCdata(site.name)}</name>`,
    "</author>",
    entries,
    "</feed>"
  ].join("");

  return new Response(xml, {
    headers: {
      "Content-Type": "application/atom+xml; charset=utf-8"
    }
  });
}
