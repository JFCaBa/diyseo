import { normalizePageUrl } from "@/lib/site-pages";

const bareHost = (host: string) => host.toLowerCase().replace(/^www\./, "");
const pageKey = (url: URL) => normalizePageUrl(url).replace(/^http:/, "https:").replace(/\/\/www\./, "//");

/** true when `href` may stay a link: another site, an anchor, mailto/tel, or one of the site's known pages. */
export function internalLinkFilter(origin: string, allowedPages: string[]): (href: string) => boolean {
  const siteHost = bareHost(new URL(origin).hostname);
  const allowed = new Set<string>([pageKey(new URL(`${origin}/`))]);
  for (const page of allowedPages) {
    try {
      allowed.add(pageKey(new URL(page)));
    } catch {
      // ignore malformed entries
    }
  }
  return (rawHref: string) => {
    const href = rawHref.trim().replace(/^<|>$/g, "");
    if (!href || href.startsWith("#") || /^(mailto|tel):/i.test(href)) return true;
    let url: URL;
    try {
      url = new URL(href, `${origin}/`);
    } catch {
      return true;
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") return true;
    if (bareHost(url.hostname) !== siteHost) return true;
    return allowed.has(pageKey(url));
  };
}

const INLINE = /(!?)\[([^\]]*)\]\(\s*(<[^>]*>|[^)\s]+)(\s+"[^"]*")?\s*\)/g;
const DEFINITION = /^ {0,3}\[([^\]]+)\]:\s*(<[^>]*>|\S+)(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*$/gm;
const HTML_ANCHOR = /<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;

function cleanProse(text: string, keep: (href: string) => boolean, removed: string[]): string {
  const dropped = new Set<string>();
  let out = text.replace(DEFINITION, (line, label: string, href: string) => {
    if (keep(href)) return line;
    removed.push(href.replace(/^<|>$/g, ""));
    dropped.add(label.trim().toLowerCase());
    return "";
  });
  out = out.replace(INLINE, (match, bang: string, label: string, href: string) => {
    if (bang || keep(href)) return match;
    removed.push(href.replace(/^<|>$/g, ""));
    return label;
  });
  out = out.replace(HTML_ANCHOR, (match, _q: string, href: string, inner: string) => {
    if (keep(href)) return match;
    removed.push(href);
    return inner;
  });
  if (dropped.size > 0) {
    // [text][label], [label][] and [label] that pointed at a removed definition become plain text.
    out = out.replace(/(!?)\[([^\]]+)\]\[([^\]]*)\]/g, (match, bang: string, label: string, ref: string) =>
      !bang && dropped.has((ref || label).trim().toLowerCase()) ? label : match
    );
    out = out.replace(/(!?)\[([^\]]+)\](?![([:])/g, (match, bang: string, label: string) =>
      !bang && dropped.has(label.trim().toLowerCase()) ? label : match
    );
  }
  return out;
}

/**
 * Turns every link to the site itself that is not one of its known pages into plain text (inline, reference and
 * HTML links), so a generated article never links to a page that does not exist. Code blocks, images, anchors,
 * mailto and other sites' links are left alone.
 */
export function sanitizeInternalLinks(
  markdown: string,
  origin: string,
  allowedPages: string[]
): { markdown: string; removed: string[] } {
  const keep = internalLinkFilter(origin, allowedPages);
  const removed: string[] = [];
  // Odd segments are fenced code blocks: never touched.
  const parts = markdown.split(/(^ {0,3}(?:```|~~~)[\s\S]*?^ {0,3}(?:```|~~~)[^\n]*$)/m);
  const out = parts.map((part, i) => (i % 2 === 1 ? part : cleanProse(part, keep, removed))).join("");
  return { markdown: out, removed };
}
