# Spanish landing page at /es, with euro prices

> **For agentic workers:** executed inline (superpowers:executing-plans). Steps use checkbox syntax.

**Goal:** a Spain Spanish version of the landing at `/es` (hreflang pair with `/`), whose prices are in euros, and where signing up from `/es` starts the app in Spanish and lets the visitor pay in euros.

**Architecture:** landing copy moves to `lib/landing/copy.ts` (one typed object per locale); `components/landing/landing-page.tsx` renders either; `app/page.tsx` (en) and `app/es/page.tsx` (es) are thin wrappers with their own metadata. Euros come from Stripe multi-currency prices: each of the 6 live prices (`diyseo_{starter,pro,agency}_{monthly,annual}`, GBP, tax inclusive) gains an EUR `currency_options` entry; no new products or lookup keys.

**Tech stack:** Next.js 15, node:test via tsx (`npm test`), Stripe API.

## Global constraints

- `/` stays byte-for-byte the same English page (same copy, same `£` prices, same metadata title/description), plus the hreflang tags and a small "Español" link.
- EUR amounts: same numbers as GBP — 29/79/199 € a month, annual 276/756/1908 € a year (23/63/159 € a month). Tax inclusive, like GBP.
- Currency rule (one pure helper, `checkoutCurrency`): the Stripe customer's existing `currency` if it has one (a customer can't mix currencies), else `eur` when the UI locale is `es`, else `gbp`.
- Checkout passes `currency`; the open-session reuse also requires the same currency; the idempotency key includes the currency.
- Prices shown in the app follow the same locale rule: `formatPlanPrice(value, locale)` → `£29` (en) / `29 €` (es); es `vatNote` and agency feature say euros.
- Signing up from `/es` sets the `diyseo-locale=es` cookie before Google sign-in. `/` does not touch the cookie.
- `<html lang="es">` on `/es`: middleware adds a request header `x-diyseo-page-locale: es` for `/es`; the root layout uses it over `getUiLocale()`.
- `/es` is public in middleware (`PUBLIC_EXACT`). Signed-in visitors are redirected exactly like on `/`.
- hreflang: both pages emit `alternates` with `en` → `/`, `es` → `/es`, `x-default` → `/`, and their own canonical, absolute from `NEXT_PUBLIC_APP_URL`.
- No change to the app's plan limits, lookup keys, webhook or sync.

## Tasks

### Task 1: copy + shared page + /es route

- `lib/landing/copy.ts`: `LandingCopy` type, `LANDING_COPY: Record<UiLocale, LandingCopy>`; en is the current text verbatim; es adapted (Spanish examples, "más de 300 € al mes").
- `components/landing/landing-page.tsx` (server) and `pricing.tsx` take `locale`; pricing uses `formatPlanPrice` and the copy's plan taglines/features (es reuses `billing.plans.*` from the app catalog through `createT("es")`).
- `app/page.tsx` → `<LandingPage locale="en" />`; `app/es/page.tsx` → `<LandingPage locale="es" />`; `landingMetadata(locale)` builds title, description, canonical and languages.
- `lib/signup-actions.ts`: `startFreeTrialEs` sets the cookie via `uiLocaleCookie("es", prod)` then signs in.
- Remove `app/page.tsx` and `components/landing/` from the raw-text `IGNORED_FILES` (the page has no raw text any more; `waitlist-form.tsx` stays listed if it still has raw text).
- Tests (`tests/landing.test.ts`): en copy equals the original strings for title/description/hero; es and en copy have the same shape; `landingMetadata` alternates; middleware lets `/es` through without a session and sets the page-locale header.

### Task 2: euro prices in the app and in Checkout

- `lib/billing-currency.ts`: `checkoutCurrency({ customerCurrency, locale }): "eur" | "gbp"`.
- `startCheckout`: retrieves the customer's currency when there is a customer, passes `currency`, compares `pending.currency` before reusing, adds the currency to the idempotency key.
- `formatPriceGbp` → `formatPlanPrice` (EUR for es); es `billing.vatNote`, `billing.plans.agency.f1` in euros.
- Tests: `checkoutCurrency` cases; `formatPlanPrice` en/es.

### Task 3 (at deploy, live Stripe): add `currency_options[eur]` (tax_behavior inclusive) to the 6 prices; check `GET /v1/prices?expand[]=data.currency_options`.

## Review focus

- `/` English output unchanged.
- An existing GBP customer who switches the UI to Spanish must still get a GBP Checkout (never a currency error).
- A pending GBP session must not be reused for an EUR checkout.
- The cookie set from `/es` must survive the Google OAuth round trip (set before `signIn` redirect).

## Consenso on this plan (2026-11-24, weakened: opencode's key expired)

Applied:
- Shown currency = charged currency: `formatPlanPrice(value, currency, locale)`; the billing page resolves the currency with `checkoutCurrency` (customer currency first).
- Stripe EUR options go in before the code deploys (Task 3 runs first), verified per price (lookup key, EUR amount, interval, tax behaviour).
- Middleware sets the page-locale header on `/` too (`en`), overwriting any incoming value.
- Pure, tested pieces of `startCheckout`: `canReusePending(pending, priceId, currency)` and the idempotency key.

Rejected:
- `/` setting `diyseo-locale=en`: a Spanish browser landing on `/` would then be forced to English; without a cookie Accept-Language already decides.
- Separate plan copy for the landing: both locales read the app's `billing.plans.*`, so landing and billing can't drift.

Consenso on the diff (2026-11-24; agy timed out, opencode key expired): applied codex's idempotency finding — the key now includes the pending session being replaced, so GBP → EUR → GBP within one 30-minute bucket gets a fresh session instead of the expired first one (test in tests/billing-currency.test.ts). Live Stripe EUR options were added to the 6 prices before deploy (same amounts, tax inclusive).
