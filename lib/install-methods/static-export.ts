import { strToU8, zipSync } from "fflate";

import { evaluateBlogHtml } from "@/lib/install-methods/verify-proxy";

export const EXPORT_LIMITS = {
  maxArticles: 200,
  maxResponseBytes: 2_000_000,
  maxTotalBytes: 40_000_000,
  concurrency: 4,
  deadlineMs: 90_000
} as const;

export class ExportError extends Error {}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Output path of an article inside the ZIP, or null for a slug that is not a plain URL segment. */
export function exportPathForSlug(slug: string): string | null {
  return slug.length > 0 && slug.length <= 100 && SLUG_RE.test(slug) ? `blog/${slug}/index.html` : null;
}

export function buildExportZip(files: Record<string, string>): Uint8Array {
  const entries: Record<string, Uint8Array> = {};

  for (const [path, content] of Object.entries(files)) {
    entries[path] = strToU8(content);
  }

  return zipSync(entries);
}

export function buildReadme(host: string, builtAt: Date): string {
  return `DIYSEO static blog export
Built: ${builtAt.toISOString()}
Domain: ${host}

How to publish
1. Upload the "blog" folder to the root of your website, so that
   https://${host}/blog/ shows the blog home and
   https://${host}/blog/<article>/ shows each article.
   If you uploaded an earlier export, delete the old "blog" folder first (or
   sync so that removed files disappear). Otherwise unpublished or renamed
   articles stay online.
2. Make sure your hosting serves index.html for folders (most do).
3. Submit https://${host}/blog/sitemap.xml in Google Search Console.

This is a snapshot. When you publish new articles in DIYSEO, download a new
ZIP and upload it again (overwrite the files).
`;
}

/** href values of every stylesheet link in the HTML, in order. */
export function extractStylesheetHrefs(html: string): string[] {
  const hrefs: string[] = [];

  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    if (/\brel=["']stylesheet["']/i.test(tag)) {
      const href = tag.match(/\bhref=["']([^"']+)["']/i)?.[1];

      if (href) {
        hrefs.push(href);
      }
    }
  }

  return hrefs;
}

/** Stylesheets are only fetched from the app's own static assets over https. */
export function resolveAllowedAssetUrl(href: string, appOrigin: string): string | null {
  try {
    const base = new URL(appOrigin);
    const url = new URL(href, base);

    if (
      url.protocol !== "https:" ||
      url.origin !== base.origin ||
      url.username ||
      url.password ||
      !url.pathname.startsWith("/_next/static/")
    ) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Makes a rendered blog page self-contained: stylesheets inlined (hashed asset
 * files disappear on every hub deploy) and all scripts removed (the blog pages
 * are server-rendered; only JSON-LD is kept).
 */
export function prepareStaticHtml(html: string, css: Map<string, string>): string {
  let out = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (match) =>
    /\btype=["']application\/ld\+json["']/i.test(match) ? match : ""
  );

  out = out.replace(/<link\b[^>]*>/gi, (tag) => {
    if (/\brel=["']stylesheet["']/i.test(tag)) {
      const href = tag.match(/\bhref=["']([^"']+)["']/i)?.[1];
      const content = href ? css.get(href) : undefined;
      return content === undefined ? "" : `<style>${content.replace(/<\/style/gi, "<\\/style")}</style>`;
    }

    if (/\brel=["'](?:preload|modulepreload|prefetch)["']/i.test(tag)) {
      return "";
    }

    return tag;
  });

  return out;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

type StaticExportInput = {
  host: string;
  siteId: string;
  slugs: string[];
  /** Public DIYSEO origin (assets must belong to it), e.g. https://diyseo.online */
  origin: string;
  /** Where the pages are fetched from (e.g. http://127.0.0.1:3000). Defaults to origin. */
  renderOrigin?: string;
  fetchImpl?: FetchLike;
};

async function readCapped(response: Response, max: number): Promise<string> {
  const reader = response.body?.getReader();

  if (!reader) {
    return "";
  }

  const chunks: Uint8Array[] = [];
  let size = 0;

  for (;;) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    size += value.length;

    if (size > max) {
      await reader.cancel();
      throw new ExportError("A page is too large to export.");
    }

    chunks.push(value);
  }

  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Runs `work` over the items with bounded concurrency. After the first failure no new
 * item is started, and the call only returns once every running item has settled, so a
 * failed export leaves no background renders behind.
 */
async function mapLimit<T, R>(items: T[], limit: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  let failure: { error: unknown } | null = null;

  async function worker() {
    while (!failure && next < items.length) {
      const index = next++;

      try {
        results[index] = await work(items[index]);
      } catch (error) {
        failure ??= { error };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));

  if (failure) {
    throw (failure as { error: unknown }).error;
  }

  return results;
}

/** Renders every public page of the site as the client domain would serve it and returns the ZIP's files. */
export async function buildStaticExport(input: StaticExportInput): Promise<Record<string, string>> {
  const { host, siteId, slugs, origin } = input;
  const renderOrigin = (input.renderOrigin ?? origin).replace(/\/$/, "");
  const fetchImpl: FetchLike = input.fetchImpl ?? ((url, init) => fetch(url, init));
  const deadline = Date.now() + EXPORT_LIMITS.deadlineMs;
  let totalBytes = 0;

  if (slugs.length > EXPORT_LIMITS.maxArticles) {
    throw new ExportError(`Static export supports up to ${EXPORT_LIMITS.maxArticles} articles; this site has ${slugs.length}.`);
  }

  for (const slug of slugs) {
    if (!exportPathForSlug(slug)) {
      throw new ExportError(`The article slug "${slug.slice(0, 60)}" cannot be exported. Use lowercase letters, numbers and hyphens.`);
    }
  }

  async function get(url: string, headers: Record<string, string> = {}): Promise<string> {
    const remaining = deadline - Date.now();

    if (remaining <= 0) {
      throw new ExportError("The export took too long. Try again.");
    }

    let response: Response;

    try {
      response = await fetchImpl(url, {
        redirect: "manual",
        headers: { "user-agent": "DIYSEO-Export/1.0", ...headers },
        signal: AbortSignal.timeout(remaining)
      });
    } catch {
      throw new ExportError("A page could not be rendered. Try again in a moment.");
    }

    if (response.status !== 200) {
      throw new ExportError(`A page returned HTTP ${response.status} while exporting (${new URL(url).pathname}).`);
    }

    const body = await readCapped(response, EXPORT_LIMITS.maxResponseBytes);
    totalBytes += body.length;

    if (totalBytes > EXPORT_LIMITS.maxTotalBytes) {
      throw new ExportError("The export is too large.");
    }

    return body;
  }

  const pageHeaders = { "x-forwarded-host": host, "x-forwarded-proto": "https" };
  const siteUrl = (path: string) => `${renderOrigin}/blog/${encodeURIComponent(siteId)}${path}`;

  const indexHtml = await get(siteUrl(""), pageHeaders);
  const check = evaluateBlogHtml({ body: indexHtml, host, siteId });

  if (!check.ok) {
    throw new ExportError(`The blog could not be rendered for ${host}: ${check.message}`);
  }

  const articleHtml = await mapLimit(slugs, EXPORT_LIMITS.concurrency, (slug) =>
    get(siteUrl(`/${encodeURIComponent(slug)}`), pageHeaders)
  );
  const [sitemap, rss, atom] = await Promise.all(
    ["/sitemap.xml", "/rss.xml", "/atom.xml"].map((path) => get(siteUrl(path), pageHeaders))
  );

  const hrefs = [...new Set([indexHtml, ...articleHtml].flatMap(extractStylesheetHrefs))];
  const css = new Map<string, string>();

  await mapLimit(hrefs, EXPORT_LIMITS.concurrency, async (href) => {
    const url = resolveAllowedAssetUrl(href, origin);

    if (!url) {
      throw new ExportError("A page references a stylesheet outside the app's own assets.");
    }

    // The policy is checked against the public origin; the bytes come from the render origin.
    const parsed = new URL(url);
    css.set(href, await get(`${renderOrigin}${parsed.pathname}${parsed.search}`));
  });

  const files: Record<string, string> = {
    "blog/index.html": prepareStaticHtml(indexHtml, css),
    "blog/sitemap.xml": sitemap,
    "blog/rss.xml": rss,
    "blog/atom.xml": atom
  };

  slugs.forEach((slug, index) => {
    files[exportPathForSlug(slug) as string] = prepareStaticHtml(articleHtml[index], css);
  });

  for (const [path, content] of Object.entries(files)) {
    if (path.endsWith(".html") && content.includes(`/blog/${siteId}`)) {
      throw new ExportError("The rendered pages still point to the DIYSEO address instead of your domain.");
    }
  }

  return files;
}
