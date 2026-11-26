import assert from "node:assert/strict";
import { test } from "node:test";

import { landingSitemapXml } from "../lib/landing/sitemap";
import { sitemapIndexXml } from "../lib/sitemap";

test("the landing sitemap lists /, /es and /pt, each with the full hreflang set", () => {
  const xml = landingSitemapXml("https://diyseo.online");
  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<urlset xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9" xmlns:xhtml="http:\/\/www.w3.org\/1999\/xhtml">/);
  const urls = [...xml.matchAll(/<url>(.*?)<\/url>/g)].map((m) => m[1]);
  assert.deepEqual(
    urls.map((u) => /<loc>(.*?)<\/loc>/.exec(u)![1]),
    ["https://diyseo.online/", "https://diyseo.online/es", "https://diyseo.online/pt"]
  );
  for (const url of urls) {
    assert.ok(url.includes('<xhtml:link rel="alternate" hreflang="en" href="https://diyseo.online/"/>'));
    assert.ok(url.includes('<xhtml:link rel="alternate" hreflang="es" href="https://diyseo.online/es"/>'));
    assert.ok(url.includes('<xhtml:link rel="alternate" hreflang="pt" href="https://diyseo.online/pt"/>'));
    assert.ok(url.includes('<xhtml:link rel="alternate" hreflang="x-default" href="https://diyseo.online/"/>'));
  }
});

test("the sitemap index lists the landing sitemap first, then every blog sitemap", () => {
  const xml = sitemapIndexXml("https://diyseo.online", [{ id: "site1", updatedAt: new Date("2026-11-20T10:00:00Z") }]);
  const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
  assert.deepEqual(locs, ["https://diyseo.online/sitemap-pages.xml", "https://diyseo.online/blog/site1/sitemap.xml"]);
  assert.ok(xml.includes("<lastmod>2026-11-20T10:00:00.000Z</lastmod>"));
});
