# European Portuguese (pt-PT) as the third language

> **For agentic workers:** executed inline (superpowers:executing-plans); the catalog translation is delegated to two subagents in parallel. Steps use checkbox syntax.

**Goal:** the whole signed-in app, the public blog chrome, the embed widget and a `/pt` landing in European Portuguese, on the same in-house i18n layer as en/es. Billing in euros for Portuguese.

**Architecture:** `UiLocale` becomes `"en" | "es" | "pt"`. `tsc` then flags every `Record<UiLocale, …>` (catalogs, landing copy, paths, currency) that needs a `pt` entry; the remaining binary `locale === "es" ? … : …` ternaries are replaced with per-locale maps. No URL prefix in the app, no dependency.

**Tech stack:** Next.js 15, node:test via tsx (`npm test`).

## Global constraints

- Portuguese is **pt-PT** (Portugal): informal "tu" forms, Portugal spelling and vocabulary (ecrã, ficheiro, registar, utilizador, telemóvel, "a carregar…" not "carregando"). Brazilian Portuguese is out of scope; `pt-BR` browsers and `pt-BR` content languages also resolve to `pt` (better than English).
- English and Spanish output stay identical, except the landing language links (see Task 3).
- `lib/i18n/messages/pt.ts`: `export const pt: Messages`, translated from `en.ts` (the source of truth), with `es.ts` as the reference for tone, product terms kept in English (Brand DNA, API, Starter/Pro/Agency, Search Console…) and placeholders (`{name}`, `{price}`…) kept verbatim. Counts keep the `*One`/`*Other` split.
- Intl locales: `intlLocale("pt")` → `"pt-PT"`; `formatDateMedium` → `"pt-PT"`; blog dates `"pt-PT"`, `blogOgLocale("pt")` → `"pt_PT"`, `blogHtmlLang("pt")` → `"pt"`.
- Accept-Language: primary tag `pt` matches (so `pt-BR` and `pt-PT` both give `pt`).
- Currency: `checkoutCurrency` → customer currency first, else `eur` for `es` and `pt`, else `gbp`.
- Landing: `/pt` (Portuguese, euros), public in middleware, `x-diyseo-page-locale: pt`. hreflang everywhere becomes en/es/pt + x-default → `/` (page metadata and `/sitemap-pages.xml`, which lists three URLs).
- Signing up from `/es` or `/pt` sets `diyseo-locale` to that language before Google sign-in (one action factory, `startFreeTrialIn(locale)`, or one action per locale; `/` still does not touch the cookie).
- The landing header shows links to the other two languages by their native names ("English", "Español", "Português"), each with `hrefLang`/`lang`.
- Public blog: `resolveBlogLocale` adds pt: `pt`, `pt-*`, `pt_*`, names starting with `portuguese`, `português`, `portugues`. `public/embed.js` keeps its ES5 copy in step; both tested against `tests/fixtures/blog-locale-cases.ts`.
- No change to plan limits, Stripe prices (EUR already exists), webhook, admin, legal pages.

## Tasks

### Task 1: locale core + Portuguese catalog

- `lib/i18n/locale.ts`: type, `isUiLocale`, `intlLocale` map; comments updated.
- `lib/i18n/messages/pt.ts` (subagents translate sections in two halves; assembled here). Add `localeSwitcher.pt` ("Português") to en ("Português"), es ("Português") and pt; switcher renders three options.
- `lib/i18n/translate.ts`: register `pt`; `formatDateMedium` map (en-GB / es-ES / pt-PT).
- Tests (`tests/i18n-core.test.ts`): `resolveUiLocale` with `pt-PT,pt;q=0.9` → pt, `pt-BR` → pt, cookie `pt` → pt; `intlLocale("pt")` = `pt-PT`; pt catalog has every en key with the same placeholders (generic placeholder-parity test across all locales if not already there); `formatPlanPrice(29,"eur","pt")` = `29 €` (with the runtime's space).

### Task 2: billing currency

- `checkoutCurrency`: `pt` → eur. Test in `tests/billing-currency.test.ts`.

### Task 3: `/pt` landing, hreflang, sitemap, sign-up

- `lib/landing/copy.ts`: `pt` copy (adapted, Portuguese examples, "mais de 300 € por mês"); `LANDING_PATH.pt = "/pt"`, `LANDING_CURRENCY.pt = "eur"`; `nav.otherLanguage` replaced by a shared native-name map used for the header links.
- `app/pt/page.tsx`; `landingMetadata` languages from `LANDING_PATH` (all locales); `landingSitemapXml` lists every `LANDING_PATH` with the full set.
- `middleware.ts`: `/pt` in `PUBLIC_EXACT` and `LANDING_LOCALES`.
- `lib/signup-actions.ts`: Portuguese sign-up sets `diyseo-locale=pt`.
- Tests: `tests/landing.test.ts` (pt copy same shape; metadata alternates en/es/pt/x-default; middleware lets `/pt` through with header `pt`), `tests/landing-sitemap.test.ts` (three urls, four alternates each).

### Task 4: public blog + embed widget

- `lib/public-blog-i18n.ts`: `BlogLocale` gains `pt`; Portuguese strings (no vendor name, like es); date/og/html maps.
- `public/embed.js`: resolver + `STRINGS.pt`; dates `pt-PT`.
- `tests/fixtures/blog-locale-cases.ts`: `pt`, `PT`, `pt-PT`, `pt_BR`, `Portuguese`, `Português (Portugal)`, `portugues` → pt; `portu` stays… (not a name prefix match rule change: `portu` → en), `pol` → en.

### Task 5: docs

- `CLAUDE.md`: the i18n section says en/es/pt; blog chrome en/es/pt.

## Review focus

- No English or Spanish string changed (apart from the switcher option and landing language links).
- Every pt catalog value keeps the en placeholders; no Brazilian forms in common words.
- A pt-BR browser gets Portuguese, not English; an unknown language still gets English.
- An existing GBP customer switching to Portuguese still gets a GBP checkout.
- embed.js stays ES5 (no arrow functions, `const`, template literals).

## Consenso (2026-11-25; opencode key expired)

- Plan: codex no findings. agy raised three points, all already covered by the implementation: no binary `=== "es"` ternaries remain (audited by grep), the landing header iterates the other languages, and the root `<html lang>` accepts pt through `isUiLocale`.
- Diff: codex no findings; agy timed out.
- Ruling: `formatDateMedium` in pt-PT gives `25/11/2026` (ICU's medium style for pt-PT), kept as is.
