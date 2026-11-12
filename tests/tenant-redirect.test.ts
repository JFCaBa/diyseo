import assert from "node:assert/strict";
import { test } from "node:test";

import { searchSuffix, siteOriginFromDomain, tenantBlogRedirect } from "@/lib/tenant-redirect";

const verified = new Date("2026-11-12T22:00:00Z");
const base = { isTenant: false, domain: "https://serfuncionario.com", proxyVerifiedAt: verified, appHost: "diyseo.online" };

test("siteOriginFromDomain keeps only http(s) origins", () => {
  assert.equal(siteOriginFromDomain("https://serfuncionario.com/blog?x=1"), "https://serfuncionario.com");
  assert.equal(siteOriginFromDomain("serfuncionario.com"), "https://serfuncionario.com");
  assert.equal(siteOriginFromDomain("javascript:alert(1)"), null);
  assert.equal(siteOriginFromDomain("not a url"), null);
});

test("a verified site redirects the hub copy to its own domain", () => {
  assert.equal(tenantBlogRedirect(base), "https://serfuncionario.com/blog");
  assert.equal(tenantBlogRedirect({ ...base, slug: "mi artículo", search: "?lang=en" }), "https://serfuncionario.com/blog/mi%20art%C3%ADculo?lang=en");
});

test("no redirect before the proxy is verified", () => {
  assert.equal(tenantBlogRedirect({ ...base, proxyVerifiedAt: null }), null);
});

test("no redirect when the request already comes through the site's domain (no loop)", () => {
  assert.equal(tenantBlogRedirect({ ...base, isTenant: true }), null);
});

test("no redirect when the site's domain is the hub itself, or is unusable", () => {
  assert.equal(tenantBlogRedirect({ ...base, domain: "https://DIYSEO.online" }), null);
  assert.equal(tenantBlogRedirect({ ...base, domain: "nonsense" }), null);
});

test("no redirect when the hub's own host is unknown (could point at ourselves)", () => {
  assert.equal(tenantBlogRedirect({ ...base, appHost: "" }), null);
});

test("searchSuffix keeps every query parameter, arrays included", () => {
  assert.equal(searchSuffix(undefined), "");
  assert.equal(searchSuffix({}), "");
  assert.equal(searchSuffix({ utm_source: "x", lang: "en", tag: ["a", "b"], skipped: undefined }), "?utm_source=x&lang=en&tag=a&tag=b");
});
