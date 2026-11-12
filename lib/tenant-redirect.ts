/**
 * Once a site's own domain serves its blog (reverse proxy verified), the copy
 * under the hub's own origin (/blog/<siteId>/...) redirects there. The redirect
 * is temporary (307): it depends on a verification that can be revoked, and a
 * cached permanent redirect would outlive it. The hub copy is noindex anyway.
 */

/** https://host origin of a site's configured domain, or null when it is not a usable http(s) URL. */
export function siteOriginFromDomain(domain: string): string | null {
  try {
    // A bare "example.com" is accepted as https://example.com.
    const url = new URL(/:\/\//.test(domain) ? domain : `https://${domain}`);
    // A real domain has a dot ("nonsense" parses as a host but is not one).
    return (url.protocol === "https:" || url.protocol === "http:") && url.hostname.includes(".") ? url.origin : null;
  } catch {
    return null;
  }
}

type TenantRedirectInput = {
  /** True when the request already arrives through the site's own domain. */
  isTenant: boolean;
  domain: string;
  proxyVerifiedAt: Date | null;
  /** Host of the hub itself (NEXT_PUBLIC_APP_URL): a site whose domain is the hub would loop. */
  appHost: string;
  slug?: string;
  /** Query string including the leading "?" (e.g. the translation language), or "". */
  search?: string;
};

export function tenantBlogRedirect({ isTenant, domain, proxyVerifiedAt, appHost, slug, search = "" }: TenantRedirectInput): string | null {
  if (isTenant || !proxyVerifiedAt) return null;
  // Without the hub's own host we cannot rule out redirecting to ourselves.
  if (!appHost) return null;

  const origin = siteOriginFromDomain(domain);
  if (!origin) return null;
  if (new URL(origin).host.toLowerCase() === appHost.toLowerCase()) return null;

  return `${origin}/blog${slug ? `/${encodeURIComponent(slug)}` : ""}${search}`;
}

/** "?a=1&b=2" from Next's searchParams (empty values and arrays preserved), or "". */
export function searchSuffix(params: Record<string, string | string[] | undefined> | undefined): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
      query.append(key, item);
    }
  }
  const text = query.toString();
  return text ? `?${text}` : "";
}
