import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { BLOG_LOCALE_CASES } from "./fixtures/blog-locale-cases";

// public/embed.js is a standalone browser script with no exports. Its locale
// rule sits between marker comments so the real function can be tested here
// against the same table as lib/public-blog-i18n.ts.
function loadEmbedResolveLocale(): (value: string | null) => "en" | "es" {
  const source = readFileSync("public/embed.js", "utf8");
  const match = source.match(/\/\/ resolveLocale:start([\s\S]*?)\/\/ resolveLocale:end/);
  assert.ok(match, "public/embed.js must wrap resolveLocale in resolveLocale:start/end markers");
  return new Function(`${match[1]}; return resolveLocale;`)();
}

test("embed.js resolveLocale follows the same rule as the blog", () => {
  const resolveLocale = loadEmbedResolveLocale();
  for (const [input, expected] of BLOG_LOCALE_CASES) {
    assert.equal(resolveLocale(input), expected, `input ${JSON.stringify(input)}`);
  }
});
