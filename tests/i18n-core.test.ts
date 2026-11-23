process.env.TZ = "UTC";

import assert from "node:assert/strict";
import { test } from "node:test";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { intlLocale, isUiLocale, resolveUiLocale, UI_LOCALE_COOKIE, uiLocaleCookie } from "@/lib/i18n/locale";
import { en } from "@/lib/i18n/messages/en";
import { es } from "@/lib/i18n/messages/es";
import { createLocalizeMessage, createT, formatDate, formatNumber } from "@/lib/i18n/translate";

// tsconfig keeps JSX as "preserve" (Next compiles it); under tsx the component needs React in scope.
(globalThis as { React?: typeof React }).React = React;

test("the cookie name and locale guard", () => {
  assert.equal(UI_LOCALE_COOKIE, "diyseo-locale");
  assert.equal(isUiLocale("en"), true);
  assert.equal(isUiLocale("es"), true);
  for (const value of ["ES", "de", "<script>", "", null, undefined, 1]) {
    assert.equal(isUiLocale(value), false, String(value));
  }
  assert.equal(intlLocale("en"), "en-US");
  assert.equal(intlLocale("es"), "es-ES");
});

test("a valid cookie wins over Accept-Language", () => {
  assert.equal(resolveUiLocale({ cookie: "es", acceptLanguage: "en-US" }), "es");
  assert.equal(resolveUiLocale({ cookie: "en", acceptLanguage: "es-ES" }), "en");
});

test("a tampered cookie is ignored and Accept-Language decides", () => {
  for (const cookie of ["de", "ES", "<script>"]) {
    assert.equal(resolveUiLocale({ cookie, acceptLanguage: "es-ES,es;q=0.9" }), "es", cookie);
  }
});

test("Accept-Language without a cookie", () => {
  const cases: Array<[string | null | undefined, "en" | "es"]> = [
    ["es-ES,es;q=0.9", "es"],
    ["es-419", "es"],
    ["en-GB,es;q=0.8", "en"],
    ["fr-FR,es;q=0.5", "es"],
    ["en;q=0.5,es;q=0.9", "es"],
    ["es;q=0,en;q=0.1", "en"],
    ["*", "en"],
    ["", "en"],
    [";;;,,=q=zz", "en"],
    [null, "en"],
    [undefined, "en"]
  ];
  for (const [acceptLanguage, expected] of cases) {
    assert.equal(resolveUiLocale({ acceptLanguage }), expected, String(acceptLanguage));
    assert.equal(resolveUiLocale({ cookie: null, acceptLanguage }), expected, String(acceptLanguage));
  }
});

test("Accept-Language ties keep header order", () => {
  assert.equal(resolveUiLocale({ acceptLanguage: "es;q=0.8,en;q=0.8" }), "es");
  assert.equal(resolveUiLocale({ acceptLanguage: "en,es" }), "en");
});

test("the switcher cookie accepts only en/es, with the agreed attributes", () => {
  assert.deepEqual(uiLocaleCookie("es", true), {
    name: "diyseo-locale",
    value: "es",
    options: { path: "/", maxAge: 31536000, sameSite: "lax", httpOnly: true, secure: true }
  });
  assert.equal(uiLocaleCookie("en", false)?.options.secure, false);
  for (const value of ["de", "ES", "<script>", "", null, undefined]) {
    assert.equal(uiLocaleCookie(value, true), null, String(value));
  }
});

test("createT looks keys up per locale", () => {
  assert.equal(createT("es")("nav.dashboard"), "Panel");
  assert.equal(createT("en")("nav.dashboard"), "Dashboard");
});

test("createT interpolates and leaves missing variables visible", () => {
  const t = createT("en");
  assert.equal(t("common.greeting", { name: "Ana" }), "Hello, Ana");
  assert.equal(t("common.greeting"), "Hello, {name}");
  assert.equal(t("common.greeting", { other: "x" }), "Hello, {name}");
  assert.equal(t("common.greeting", { name: "Ana", extra: 1 }), "Hello, Ana");
  assert.equal(createT("es")("common.greeting", { name: "Ana" }), "Hola, Ana");
});

test("localizeMessage maps catalog errors and leaves anything else verbatim", () => {
  const localize = createLocalizeMessage("es");
  assert.equal(localize(en.errors.titleRequired), es.errors.titleRequired);
  assert.notEqual(es.errors.titleRequired, en.errors.titleRequired);
  assert.equal(localize("Some unknown error"), "Some unknown error");
  assert.equal(localize(undefined), "");
  assert.equal(localize(null), "");
  assert.equal(createLocalizeMessage("en")(en.errors.titleRequired), en.errors.titleRequired);
});

test("localizeMessage only looks in the errors catalog", () => {
  assert.equal(createLocalizeMessage("es")(en.nav.dashboard), en.nav.dashboard);
});

test("formatDate and formatNumber follow the locale", () => {
  const date = new Date("2026-11-23T12:00:00Z");
  assert.equal(formatDate(date, "es", { dateStyle: "long" }), "23 de noviembre de 2026");
  assert.equal(formatDate(date, "en", { dateStyle: "long" }), "November 23, 2026");
  assert.equal(formatDate("2026-11-23T12:00:00Z", "en", { dateStyle: "long" }), "November 23, 2026");
  assert.equal(formatNumber(12345.5, "en"), "12,345.5");
  assert.equal(formatNumber(12345.5, "es"), "12.345,5");
});

test("without a provider, the switcher and useT render English", async () => {
  const { LocaleSwitcher } = await import("@/components/locale-switcher");
  const { useT, useLocale } = await import("@/components/i18n-provider");

  const switcherHtml = renderToStaticMarkup(createElement(LocaleSwitcher));
  assert.match(switcherHtml, /English/);
  assert.match(switcherHtml, /Español/);
  assert.match(switcherHtml, new RegExp(en.localeSwitcher.label));
  assert.match(switcherHtml, /name="locale"/);
  assert.match(switcherHtml, /<option value="en" selected="">/);

  function Probe() {
    const t = useT();
    return createElement("span", null, `${t("nav.dashboard")}|${useLocale()}`);
  }
  assert.equal(renderToStaticMarkup(createElement(Probe)), "<span>Dashboard|en</span>");
});

test("with a Spanish provider, the switcher and useT render Spanish", async () => {
  const { LocaleSwitcher } = await import("@/components/locale-switcher");
  const { I18nProvider, useLocalizeMessage, useT } = await import("@/components/i18n-provider");

  function Probe() {
    const t = useT();
    const localize = useLocalizeMessage();
    return createElement("span", null, `${t("nav.dashboard")}|${localize(en.errors.titleRequired)}`);
  }
  const html = renderToStaticMarkup(
    createElement(I18nProvider, {
      locale: "es",
      children: [createElement(Probe, { key: "probe" }), createElement(LocaleSwitcher, { key: "switcher" })]
    })
  );
  assert.match(html, new RegExp(`<span>Panel\\|${es.errors.titleRequired}</span>`));
  assert.match(html, /<option value="es" selected="">/);
  assert.match(html, new RegExp(es.localeSwitcher.label));
});
