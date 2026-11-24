import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import ts from "typescript";

/** Files already moved onto lib/i18n: they must not contain raw English UI text. Append-only per task. */
const MIGRATED_FILES: string[] = [
  "components/locale-switcher.tsx",
  "components/sidebar-nav.tsx",
  // Task 2: app shell and onboarding
  "app/[siteId]/layout.tsx",
  "components/app-i18n.tsx",
  "components/site-selector.tsx",
  "components/auth-buttons.tsx",
  "components/page-header.tsx",
  "components/empty-state.tsx",
  "components/blog-only.tsx",
  "components/standalone-page.tsx",
  "components/satellite-page.tsx",
  "app/new-site/page.tsx",
  "components/create-site-form.tsx",
  "app/invite/[token]/page.tsx",
  "app/sso/login/page.tsx",
  "app/not-found.tsx",
  // Task 3: site dashboard and install methods
  "app/[siteId]/page.tsx",
  "components/widget-install-card.tsx",
  "components/install-reverse-proxy-panel.tsx",
  "components/install-static-export-panel.tsx",
  "components/seo-performance-section.tsx",
  // Task 4: Brand DNA
  "app/[siteId]/brand-dna/page.tsx",
  "components/brand-dna-form.tsx",
  "app/api/internal/sites/[siteId]/brand-dna/generate/route.ts",
  // Task 5: articles list, create, generate, preview
  "app/[siteId]/articles/page.tsx",
  "app/[siteId]/articles/new/page.tsx",
  "components/article-create-form.tsx",
  "components/article-generation-form.tsx",
  "components/article-keyword-assignment.tsx",
  "components/article-status-toggle.tsx",
  "components/article-delete-button.tsx",
  "app/[siteId]/preview/page.tsx",
  // Task 6: article editor, translations, social posts
  "app/[siteId]/articles/[articleId]/page.tsx",
  "components/article-editor-form.tsx",
  "components/article-translation-form.tsx",
  "components/social-posts-panel.tsx",
  // Task 7: keywords and calendar
  "app/[siteId]/keywords/page.tsx",
  "components/create-keyword-form.tsx",
  "components/suggested-keywords.tsx",
  "app/[siteId]/calendar/page.tsx",
  "components/calendar-month-view.tsx"
];

/** Proper names and symbols that may appear untranslated. */
const ALLOWED_TEXT = [
  "DIYSEO",
  "Brand DNA",
  "Search Console",
  "RSS",
  "Atom",
  "robots.txt",
  "Facebook",
  "Instagram",
  "X",
  "LinkedIn",
  "Stripe",
  "Google",
  "·",
  "→",
  "←",
  "©"
];

const TEXT_ATTRIBUTES = new Set(["placeholder", "title", "aria-label", "alt", "label", "description"]);
const SKIPPED_ELEMENTS = new Set(["pre", "code", "kbd"]);

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Word-like terms are removed only as whole words, so "X" doesn't eat the x of "Export".
const ALLOWED_PATTERNS = ALLOWED_TEXT.map((term) =>
  /^\w/.test(term) ? new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(term)}(?![\\p{L}\\p{N}])`, "gu") : new RegExp(escapeRegExp(term), "g")
);

function isRawText(text: string) {
  let rest = text;
  for (const pattern of ALLOWED_PATTERNS) rest = rest.replace(pattern, " ");
  return /\p{Script=Latin}{3,}/u.test(rest);
}

function elementName(node: ts.Node): string | null {
  if (ts.isJsxElement(node)) return node.openingElement.tagName.getText();
  if (ts.isJsxSelfClosingElement(node)) return node.tagName.getText();
  return null;
}

function attributeText(initializer: ts.JsxAttributeValue | undefined): string | null {
  if (!initializer) return null;
  if (ts.isStringLiteral(initializer)) return initializer.text;
  if (ts.isJsxExpression(initializer) && initializer.expression) {
    const expression = initializer.expression;
    if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) return expression.text;
  }
  return null;
}

function collectRawText(fileName: string, source: string): string[] {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: string[] = [];

  function visit(node: ts.Node) {
    const name = elementName(node);
    if (name && SKIPPED_ELEMENTS.has(name)) return;

    if (ts.isJsxText(node)) {
      const text = node.text.replace(/\s+/g, " ").trim();
      if (text && isRawText(text)) found.push(text);
    } else if (ts.isJsxAttribute(node) && TEXT_ATTRIBUTES.has(node.name.getText())) {
      const text = attributeText(node.initializer);
      if (text && isRawText(text)) found.push(`${node.name.getText()}="${text}"`);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return found;
}

test("the scanner flags JSX text and text attributes, and skips allowed terms and code", () => {
  const source = `
    export function Sample() {
      return (
        <div title="Open settings" data-x="Not checked">
          Hello world
          <span>{label}</span>
          <span>DIYSEO · X → Brand DNA</span>
          <code>npm run dev</code>
          <pre><span>raw inside pre</span></pre>
          <input placeholder={"Type here"} aria-label={label} />
          <span>Export</span>
        </div>
      );
    }`;
  assert.deepEqual(collectRawText("sample.tsx", source), [
    'title="Open settings"',
    "Hello world",
    'placeholder="Type here"',
    "Export"
  ]);
});

test("migrated files contain no raw English UI text", () => {
  const root = path.resolve(__dirname, "..");
  const problems: string[] = [];
  for (const file of MIGRATED_FILES) {
    const source = readFileSync(path.join(root, file), "utf8");
    for (const text of collectRawText(file, source)) problems.push(`${file}: ${text}`);
  }
  assert.deepEqual(problems, [], `raw text left:\n${problems.join("\n")}`);
});
