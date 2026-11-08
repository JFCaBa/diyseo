import assert from "node:assert/strict";
import { test } from "node:test";
import { isBlogPath } from "../components/blog-only";

test("the blog header shows on blog pages only", () => {
  for (const p of ["/s1", "/s1/articles", "/s1/articles/new", "/s1/brand-dna", "/s1/keywords", "/s1/preview"]) {
    assert.equal(isBlogPath(p, "s1"), true, p);
  }
  for (const p of ["/s1/ads", "/s1/ads/connections", "/s1/seo-data/sources", "/s1/team", "/s1/billing", "/s1/settings"]) {
    assert.equal(isBlogPath(p, "s1"), false, p);
  }
});
