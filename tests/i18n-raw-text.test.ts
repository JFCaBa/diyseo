import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import ts from "typescript";

/**
 * Every `.tsx` under app/ and components/ is scanned for raw English UI text, so new screens are audited
 * automatically. A file belongs here only with a reason: the surface is out of scope for the signed-in
 * UI translation, or it is a known gap marked `TODO(i18n)`.
 */
const IGNORED_FILES: string[] = [
  // Out of scope: the operator panel is English only (global, gated by ADMIN_EMAILS).
  "app/admin/",
  "components/admin-plan-actions.tsx",
  "components/admin-shell.tsx",
  // Out of scope: the public blog and its widget demo follow the site's content language (lib/public-blog-i18n.ts, phase 1).
  "app/blog/",
  // Out of scope: marketing landing page and its components.
  "app/page.tsx",
  "components/landing/",
  // Out of scope: legal pages.
  "app/privacy/",
  "app/terms/"
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

function scannedFiles(root: string): string[] {
  const out: string[] = [];
  for (const dir of ["app", "components"]) {
    for (const entry of readdirSync(path.join(root, dir), { recursive: true, withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".tsx")) continue;
      out.push(path.posix.join(dir, path.relative(path.join(root, dir), path.join(entry.parentPath, entry.name)).split(path.sep).join("/")));
    }
  }
  return out.sort();
}

test("every screen under app/ and components/ is free of raw English UI text, or listed in IGNORED_FILES", () => {
  const root = path.resolve(__dirname, "..");
  const files = scannedFiles(root);
  assert.ok(files.length > 50, "expected to find the app's tsx files");
  const stale = IGNORED_FILES.filter((entry) => !files.some((file) => file === entry || file.startsWith(entry)));
  assert.deepEqual(stale, [], `IGNORED_FILES entries that match no file:\n${stale.join("\n")}`);
  const problems: string[] = [];
  for (const file of files) {
    if (IGNORED_FILES.some((entry) => file === entry || file.startsWith(entry))) continue;
    const source = readFileSync(path.join(root, file), "utf8");
    for (const text of collectRawText(file, source)) problems.push(`${file}: ${text}`);
  }
  assert.deepEqual(problems, [], `raw text left:\n${problems.join("\n")}`);
});

// Consenso D3: /billing and /team render client forms through StandalonePage when the workspace has
// no site, outside the [siteId] layout's provider; without one they fell back to English.
test("signed-in pages outside the [siteId] layout mount the i18n provider", () => {
  const root = path.join(__dirname, "..");
  for (const file of ["components/standalone-page.tsx", "app/new-site/page.tsx"]) {
    assert.match(readFileSync(path.join(root, file), "utf8"), /<AppI18n>/, file);
  }
});

test("the analytics loading fallback is not an async server component", () => {
  const source = readFileSync(path.join(__dirname, "..", "app/[siteId]/analytics/loading.tsx"), "utf8");
  assert.doesNotMatch(source, /export default async function/);
});
