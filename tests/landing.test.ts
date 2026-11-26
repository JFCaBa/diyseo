import assert from "node:assert/strict";
import { test } from "node:test";

import { NextRequest } from "next/server";

import { LANDING_COPY } from "../lib/landing/copy";
import { landingMetadata } from "../lib/landing/metadata";
import { middleware } from "../middleware";

function request(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(`http://x${path}`, { headers });
}

test("the English landing keeps its original title, description and hero", () => {
  const en = LANDING_COPY.en;
  assert.equal(en.meta.title, "DIYSEO: get found on Google and in AI answers");
  assert.equal(
    en.meta.description,
    "DIYSEO finds the searches you're missing and publishes the content your website lacks, in your brand voice and on your own domain."
  );
  assert.equal(en.hero.title, "Get found on Google and in AI answers.");
  assert.equal(en.pricing.intro, "7-day free trial, no card needed. Then choose a plan. Prices in GBP, including any VAT due.");
});

test("the Spanish copy has exactly the same shape as the English one", () => {
  const shape = (value: unknown): unknown =>
    Array.isArray(value) ? value.map(shape) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shape(v)])) : typeof value;
  assert.deepEqual(shape(LANDING_COPY.es), shape(LANDING_COPY.en));
});

test("every landing declares all three as hreflang alternates, with / as x-default", () => {
  const previous = process.env.NEXT_PUBLIC_APP_URL;
  process.env.NEXT_PUBLIC_APP_URL = "https://diyseo.online/";
  try {
    const languages = { en: "https://diyseo.online/", es: "https://diyseo.online/es", pt: "https://diyseo.online/pt", "x-default": "https://diyseo.online/" };
    const en = landingMetadata("en");
    const es = landingMetadata("es");
    assert.deepEqual(en.alternates, { canonical: "https://diyseo.online/", languages });
    assert.deepEqual(es.alternates, { canonical: "https://diyseo.online/es", languages });
    assert.deepEqual(landingMetadata("pt").alternates, { canonical: "https://diyseo.online/pt", languages });
    assert.equal(en.title, LANDING_COPY.en.meta.title);
    assert.equal(es.title, LANDING_COPY.es.meta.title);
  } finally {
    process.env.NEXT_PUBLIC_APP_URL = previous;
  }
});

test("/es is public, and each landing pins its page language over any incoming value", () => {
  const es = middleware(request("/es", { "x-diyseo-page-locale": "en" }));
  assert.equal(es.headers.get("x-middleware-next"), "1");
  assert.equal(es.headers.get("x-middleware-request-x-diyseo-page-locale"), "es");

  const en = middleware(request("/", { cookie: "diyseo-locale=es" }));
  assert.equal(en.headers.get("x-middleware-request-x-diyseo-page-locale"), "en");
});

test("other routes never carry a page language, even a forged one", () => {
  const res = middleware(request("/blog", { "x-diyseo-page-locale": "es" }));
  assert.equal(res.headers.get("x-middleware-next"), "1");
  assert.notEqual(res.headers.get("x-middleware-request-x-diyseo-page-locale"), "es");
});
