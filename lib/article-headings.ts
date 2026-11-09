import { mapProse } from "@/lib/markdown-prose";

const norm = (s: string) =>
  s.replace(/[*_`#"'“”‘’]/g, "").replace(/[.:!?;,\s]+$/g, "").replace(/\s+/g, " ").trim().toLowerCase();

/**
 * The page template already renders the article title as the page's only H1. Generated content sometimes
 * repeats it, or uses H1 for its sections, which gives the page two H1s. This drops a leading H1 that repeats
 * the title and, if any H1 is left, moves every heading one level down (# → ##, ## → ###, at most ######) so
 * the outline keeps its shape. ATX ("#  Title") and Setext ("Title\n===") H1s are handled; code is untouched.
 */
export function normalizeArticleHeadings(markdown: string, title: string): string {
  // Setext H1 → ATX, so the rest only deals with "#" headings.
  let md = mapProse(markdown, (p) => p.replace(/^( {0,3})(\S[^\n]*)\n {0,3}=+[ \t]*$/gm, "$1# $2"));
  md = mapProse(md, (p, i) =>
    i === 0 ? p.replace(/^\s*# {0,3}#?[ \t]+(.+?)[ \t#]*(?:\n+|$)/, (m, text: string) => (norm(text) === norm(title) ? "" : m)) : p
  );
  const hasH1 = (p: string) => /^ {0,3}#[ \t]+\S/m.test(p);
  let anyH1 = false;
  mapProse(md, (p) => {
    if (hasH1(p)) anyH1 = true;
    return p;
  });
  if (!anyH1) return md;
  return mapProse(md, (p) => p.replace(/^( {0,3})(#{1,6})(?=[ \t]+\S)/gm, (_m, indent: string, hashes: string) => indent + (hashes.length < 6 ? hashes + "#" : hashes)));
}
