import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { NextRequest } from "next/server";

import { checkoutCurrency } from "../lib/billing-currency";
import { intlLocale, isUiLocale, resolveUiLocale, uiLocaleCookie } from "../lib/i18n/locale";
import { en } from "../lib/i18n/messages/en";
import { es } from "../lib/i18n/messages/es";
import { pt } from "../lib/i18n/messages/pt";
import { createT, formatDateMedium, formatPlanPrice } from "../lib/i18n/translate";
import { LANDING_COPY, LANDING_CURRENCY, LANDING_PATH } from "../lib/landing/copy";
import { blogHtmlLang, blogOgLocale, formatBlogDate, getBlogStrings } from "../lib/public-blog-i18n";
import { middleware } from "../middleware";

function flatten(value: unknown, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof child === "string") out.set(path, child);
    else for (const [k, v] of flatten(child, path)) out.set(k, v);
  }
  return out;
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

test("pt is a UI locale: cookie, Accept-Language (pt-PT and pt-BR) and Intl", () => {
  assert.equal(isUiLocale("pt"), true);
  assert.equal(resolveUiLocale({ cookie: "pt", acceptLanguage: "en" }), "pt");
  assert.equal(resolveUiLocale({ acceptLanguage: "pt-PT,pt;q=0.9,en;q=0.8" }), "pt");
  assert.equal(resolveUiLocale({ acceptLanguage: "pt-BR" }), "pt");
  assert.equal(resolveUiLocale({ acceptLanguage: "de,fr" }), "en");
  assert.equal(uiLocaleCookie("pt", true)?.value, "pt");
  assert.equal(intlLocale("pt"), "pt-PT");
});

test("the Portuguese catalog has every English key, with the same placeholders", () => {
  const source = flatten(en);
  const target = flatten(pt);
  assert.deepEqual([...target.keys()].sort(), [...source.keys()].sort());
  for (const [key, text] of source) {
    assert.deepEqual(placeholders(target.get(key)!), placeholders(text), key);
  }
});

test("the switcher names Portuguese in every language, and pt text is Portuguese", () => {
  assert.equal(en.localeSwitcher.pt, "Português");
  assert.equal(es.localeSwitcher.pt, "Português");
  assert.equal(pt.localeSwitcher.pt, "Português");
  assert.notEqual(createT("pt")("nav.settings"), createT("en")("nav.settings"));
});

test("Portuguese dates and prices use pt-PT, billed in euros by default", () => {
  assert.equal(formatDateMedium(new Date("2026-11-25T12:00:00Z"), "pt"), "25/11/2026");
  assert.equal(formatPlanPrice(29, "eur", "pt").replace(/\s/g, " "), "29 €");
  assert.equal(checkoutCurrency({ customerCurrency: null, locale: "pt" }), "eur");
  assert.equal(checkoutCurrency({ customerCurrency: "gbp", locale: "pt" }), "gbp");
});

test("/pt landing: Portuguese copy with the same shape, euros, public with page language pt", () => {
  const shape = (value: unknown): unknown =>
    Array.isArray(value) ? value.map(shape) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shape(v)])) : typeof value;
  assert.deepEqual(shape(LANDING_COPY.pt), shape(LANDING_COPY.en));
  assert.equal(LANDING_PATH.pt, "/pt");
  assert.equal(LANDING_CURRENCY.pt, "eur");

  const res = middleware(new NextRequest("http://x/pt", { headers: { "x-diyseo-page-locale": "en" } }));
  assert.equal(res.headers.get("x-middleware-next"), "1");
  assert.equal(res.headers.get("x-middleware-request-x-diyseo-page-locale"), "pt");
});

test("public blog chrome in Portuguese", () => {
  const strings = getBlogStrings("pt");
  assert.deepEqual(Object.keys(strings).sort(), Object.keys(getBlogStrings("en")).sort());
  assert.equal(formatBlogDate("2026-11-23T12:00:00Z", "pt"), "23 de novembro de 2026");
  assert.equal(blogHtmlLang("pt"), "pt");
  assert.equal(blogOgLocale("pt"), "pt_PT");
  assert.ok(!strings.indexIntro("X").includes("DIYSEO"));
});

test("embed.js has Portuguese strings for every English key", () => {
  const source = readFileSync("public/embed.js", "utf8");
  const block = /var STRINGS = (\{[\s\S]*?\n  \});/.exec(source);
  assert.ok(block);
  const STRINGS = new Function(`return ${block[1]};`)() as Record<string, Record<string, string>>;
  assert.deepEqual(Object.keys(STRINGS.pt).sort(), Object.keys(STRINGS.en).sort());
  assert.match(source, /"pt-PT"/);
});
