/**
 * The site's real pages, read from its sitemap, so generated articles only link to URLs that exist.
 * Everything here fails soft: no sitemap (or any error) means "only the home page".
 */

export const MAX_SITE_PAGES = 60;
const MAX_CHILD_SITEMAPS = 3;
const MAX_SITEMAP_BYTES = 2_000_000;
const TIMEOUT_MS = 5_000;

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;
/** Resolves a host to its IP addresses (injectable for tests). */
export type ResolveFn = (host: string) => Promise<string[]>;

const MAX_REDIRECTS = 2;

async function resolveHost(host: string): Promise<string[]> {
  const { lookup } = await import("node:dns/promises");
  return (await lookup(host, { all: true })).map((a) => a.address);
}

/** Loopback, private, link-local, CGNAT and unique-local addresses: never fetched. */
export function isPrivateAddress(ip: string): boolean {
  const v4 = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  const m = v4.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v6 = ip.toLowerCase();
  return v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe8") ||
    v6.startsWith("fe9") || v6.startsWith("fea") || v6.startsWith("feb");
}

const bareHost = (host: string) => host.toLowerCase().replace(/^www\./, "");

/** https origin for a site's domain field ("example.com" or "https://example.com/"), or null if it is not a public host. */
export function siteOrigin(domain: string): string | null {
  const raw = domain.trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  const isIp = /^[\d.]+$/.test(host) || host.includes(":") || host.startsWith("[");
  if (isIp || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || !host.includes(".")) {
    return null;
  }
  return `https://${host}`;
}

/** "https://site/a/b/" → "https://site/a/b"; the root stays "https://site/". Query and hash are dropped. */
export function normalizePageUrl(url: URL): string {
  const path = url.pathname.replace(/\/+$/, "");
  return `${url.protocol}//${url.host.toLowerCase()}${path || "/"}`;
}

export function parseSitemapLocs(xml: string): { isIndex: boolean; locs: string[] } {
  const locs = Array.from(xml.matchAll(/<loc>\s*(?:<!\[CDATA\[\s*)?([^<\]\s]+)\s*(?:\]\]>\s*)?<\/loc>/gi), (m) =>
    m[1].replace(/&amp;/g, "&")
  );
  return { isIndex: /<sitemapindex[\s>]/i.test(xml), locs };
}

/** Same-site URLs only, deduplicated, shallowest first, at most `max`, always starting with the home page. */
export function pickSitePages(locs: string[], origin: string, max = MAX_SITE_PAGES): string[] {
  const siteHost = bareHost(new URL(origin).hostname);
  const seen = new Set<string>();
  const pages: URL[] = [];
  for (const loc of locs) {
    let url: URL;
    try {
      url = new URL(loc);
    } catch {
      continue;
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") continue;
    if (bareHost(url.hostname) !== siteHost) continue;
    const key = normalizePageUrl(url);
    if (seen.has(key)) continue;
    seen.add(key);
    pages.push(url);
  }
  const depth = (u: URL) => u.pathname.split("/").filter(Boolean).length;
  pages.sort((a, b) => depth(a) - depth(b) || a.pathname.length - b.pathname.length);
  const home = normalizePageUrl(new URL(`${origin}/`));
  const rest = pages.map(normalizePageUrl).filter((u) => bareHost(new URL(u).hostname) !== siteHost || new URL(u).pathname !== "/");
  return [home, ...rest].slice(0, max);
}

async function readCapped(res: Response): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.byteLength;
    if (size >= MAX_SITEMAP_BYTES) {
      await reader.cancel();
      break;
    }
  }
  return new TextDecoder().decode(Buffer.concat(chunks).subarray(0, MAX_SITEMAP_BYTES));
}

/** GET on the site's own host only: redirects are followed by hand and only within the site. */
async function fetchText(url: string, siteHost: string, fetchFn: FetchFn): Promise<string | null> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetchFn(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: "application/xml,text/xml;q=0.9,*/*;q=0.1" }
    });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) return null;
      const next = new URL(location, current);
      if (next.protocol !== "https:" || bareHost(next.hostname) !== siteHost) return null;
      current = next.toString();
      continue;
    }
    return res.ok ? readCapped(res) : null;
  }
  return null;
}

/** The site's pages from /sitemap.xml (one level of sitemap index), or just the home page when that fails. */
export async function fetchSitePages(
  domain: string,
  fetchFn: FetchFn = fetch,
  resolve: ResolveFn = resolveHost
): Promise<string[]> {
  const origin = siteOrigin(domain);
  if (!origin) return [];
  const siteHost = bareHost(new URL(origin).hostname);
  try {
    // A public name can still point at an internal address: check before fetching anything.
    const addresses = await resolve(new URL(origin).hostname);
    if (addresses.length === 0 || addresses.some(isPrivateAddress)) return [`${origin}/`];
    const root = await fetchText(`${origin}/sitemap.xml`, siteHost, fetchFn);
    if (!root) return [`${origin}/`];
    const parsed = parseSitemapLocs(root);
    let locs = parsed.locs;
    if (parsed.isIndex) {
      const children = parsed.locs
        .filter((loc) => {
          try {
            return bareHost(new URL(loc).hostname) === siteHost;
          } catch {
            return false;
          }
        })
        .slice(0, MAX_CHILD_SITEMAPS);
      const texts = await Promise.all(children.map((c) => fetchText(c, siteHost, fetchFn).catch(() => null)));
      locs = texts.flatMap((t) => (t ? parseSitemapLocs(t).locs : []));
    }
    return pickSitePages(locs, origin);
  } catch {
    return [`${origin}/`];
  }
}
