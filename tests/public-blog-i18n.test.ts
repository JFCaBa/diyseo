process.env.TZ = "UTC";

import assert from "node:assert/strict";
import { test } from "node:test";

import { formatBlogDate, getBlogStrings, resolveBlogLocale } from "@/lib/public-blog-i18n";

import { BLOG_LOCALE_CASES } from "./fixtures/blog-locale-cases";

test("resolveBlogLocale maps codes and free-text Spanish names to es, everything else to en", () => {
  for (const [input, expected] of BLOG_LOCALE_CASES) {
    assert.equal(resolveBlogLocale(input), expected, `input ${JSON.stringify(input)}`);
  }
  assert.equal(resolveBlogLocale(undefined), "en");
});

test("formatBlogDate writes long dates in the blog locale", () => {
  assert.equal(formatBlogDate(new Date("2026-11-23T12:00:00Z"), "es"), "23 de noviembre de 2026");
  assert.equal(formatBlogDate(new Date("2026-11-23T12:00:00Z"), "en"), "November 23, 2026");
});

test("formatBlogDate accepts ISO strings", () => {
  assert.equal(formatBlogDate("2026-11-23T12:00:00Z", "es"), "23 de noviembre de 2026");
});

test("blog strings: Spanish copy for es, unchanged English copy for en, same keys", () => {
  const es = getBlogStrings("es");
  const en = getBlogStrings("en");
  assert.equal(es.blogTitle("Fisio Ruzafa"), "Blog de Fisio Ruzafa");
  assert.equal(en.blogTitle("X"), "X Blog");
  assert.equal(en.eyebrow, "Public Blog");
  assert.equal(es.published("23 de noviembre de 2026"), "Publicado el 23 de noviembre de 2026");
  assert.deepEqual(Object.keys(es).sort(), Object.keys(en).sort());
});
