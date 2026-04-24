import { headers } from "next/headers";

function getDefaultHost() {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL ?? "").host;
  } catch {
    return "";
  }
}

function getDefaultOrigin() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
}

export type PublicUrls = {
  isTenant: boolean;
  origin: string;
  indexPath: string;
  articlePath: (slug: string) => string;
  sitemapPath: string;
  rssPath: string;
  atomPath: string;
  robotsPath: string;
  indexUrl: string;
  articleUrl: (slug: string) => string;
  sitemapUrl: string;
  rssUrl: string;
  atomUrl: string;
};

export async function getPublicUrls(siteId: string): Promise<PublicUrls> {
  const h = await headers();
  const forwardedHost = h.get("x-forwarded-host");
  const forwardedProto = h.get("x-forwarded-proto") ?? "https";
  const defaultHost = getDefaultHost();

  const isTenant = Boolean(
    forwardedHost && defaultHost && forwardedHost.toLowerCase() !== defaultHost.toLowerCase()
  );

  if (isTenant && forwardedHost) {
    const origin = `${forwardedProto}://${forwardedHost}`;
    const indexPath = "/blog";
    const sitemapPath = "/blog/sitemap.xml";
    const rssPath = "/blog/rss.xml";
    const atomPath = "/blog/atom.xml";
    const robotsPath = "/robots.txt";

    return {
      isTenant: true,
      origin,
      indexPath,
      articlePath: (slug: string) => `/blog/${slug}`,
      sitemapPath,
      rssPath,
      atomPath,
      robotsPath,
      indexUrl: `${origin}${indexPath}`,
      articleUrl: (slug: string) => `${origin}/blog/${slug}`,
      sitemapUrl: `${origin}${sitemapPath}`,
      rssUrl: `${origin}${rssPath}`,
      atomUrl: `${origin}${atomPath}`
    };
  }

  const origin = getDefaultOrigin();
  const indexPath = `/blog/${siteId}`;
  const sitemapPath = `/blog/${siteId}/sitemap.xml`;
  const rssPath = `/blog/${siteId}/rss.xml`;
  const atomPath = `/blog/${siteId}/atom.xml`;
  const robotsPath = "/blog/robots.txt";

  return {
    isTenant: false,
    origin,
    indexPath,
    articlePath: (slug: string) => `/blog/${siteId}/${slug}`,
    sitemapPath,
    rssPath,
    atomPath,
    robotsPath,
    indexUrl: origin ? `${origin}${indexPath}` : indexPath,
    articleUrl: (slug: string) => (origin ? `${origin}/blog/${siteId}/${slug}` : `/blog/${siteId}/${slug}`),
    sitemapUrl: origin ? `${origin}${sitemapPath}` : sitemapPath,
    rssUrl: origin ? `${origin}${rssPath}` : rssPath,
    atomUrl: origin ? `${origin}${atomPath}` : atomPath
  };
}
