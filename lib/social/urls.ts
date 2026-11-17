import { getAppOrigin, buildPublicArticleUrl } from "@/lib/app-origin";
import { withLink } from "@/lib/social/text";
import { siteOriginFromDomain } from "@/lib/tenant-redirect";

export { withLink };

/** The article's public URL: the client's own domain once its reverse proxy is verified, otherwise the hub copy. */
export function articleShareUrl(site: { id: string; domain: string; proxyVerifiedAt: Date | null }, slug: string): string {
  const origin = site.proxyVerifiedAt ? siteOriginFromDomain(site.domain) : null;
  const appOrigin = getAppOrigin();
  const appHost = appOrigin ? new URL(appOrigin).host.toLowerCase() : "";
  if (origin && new URL(origin).host.toLowerCase() !== appHost) return `${origin}/blog/${slug}`;
  return buildPublicArticleUrl(site.id, slug);
}

/**
 * Public JPEG of the article's cover for Meta; `coverVersion` changes when the cover does (cache-buster).
 * Null when NEXT_PUBLIC_APP_URL is not an absolute URL: Meta could not fetch a relative one.
 */
export function socialImageUrl(siteId: string, articleId: string, coverVersion: string): string | null {
  if (!/^https?:\/\//.test(getAppOrigin())) return null;
  return `${getAppOrigin()}/api/public/sites/${siteId}/social-image/${articleId}?v=${encodeURIComponent(coverVersion)}`;
}

export function xIntentUrl(text: string, url: string): string {
  return `https://x.com/intent/post?${new URLSearchParams({ text, url }).toString()}`;
}

export function linkedinIntentUrl(text: string, url: string): string {
  return `https://www.linkedin.com/feed/?${new URLSearchParams({ shareActive: "true", text: withLink(text, url) }).toString()}`;
}

/** Last path segment of the cover URL: changes whenever the cover does, so Meta never gets a stale cached image. */
export function coverVersion(coverImageUrl: string): string {
  return coverImageUrl.split("/").pop() ?? "1";
}

/** The public image is rendered only for the cover's current version, so a varying `v` cannot force new work. */
export function isCurrentCoverVersion(coverImageUrl: string, v: string | null): boolean {
  return v !== null && v === coverVersion(coverImageUrl);
}
