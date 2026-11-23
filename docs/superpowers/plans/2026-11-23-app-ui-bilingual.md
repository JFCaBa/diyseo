# Bilingual (es/en) signed-in app UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every screen a signed-in user sees renders in Spanish or English, chosen per browser by cookie / `Accept-Language`, with a switcher in the app sidebar.

**Architecture:** A small in-house i18n layer in `lib/i18n/` (no new dependency): typed `en`/`es` dictionaries, `resolveUiLocale`, a server translator `getT()` (cookie → `Accept-Language` → `en`), and a client `I18nProvider`/`useT()` mounted only in signed-in layouts so public blog pages don't ship the dictionary. Server actions and route handlers translate their own messages at the source with `t(key, vars)` (they run on the server with the cookie). Only the static English strings that come out of Zod (`lib/validations.ts`, including Zod's default messages) and a few static `lib/*` errors go through `localizeMessage()`, a reverse lookup restricted to the closed `errors` catalog, whose English values are tested to be unique; anything not in the catalog shows verbatim. Messages with runtime values never use reverse lookup. Strings move to the dictionaries one screen group per task; a guard test fails while a listed file still contains raw English JSX text.

**Tech Stack:** Next.js 15 App Router (server components + server actions), React 19, TypeScript, `node:test` via `tsx`.

**Spec:** Decisions in memory `project_ui_spanish.md` (Jose, 2026-11-23): bilingual es/en, whole signed-in app, several deliveries, no locale prefix in URLs. Phase 1 (public blog language, `lib/public-blog-i18n.ts`) is done and stays separate: the blog follows the *site's* content language, the app follows the *user's* UI language.

## Global Constraints

- No URL locale prefix, no new route segments, no new npm dependency.
- Locale values: exactly `"en" | "es"`. Cookie `diyseo-locale`, `path=/`, `max-age=31536000`, `sameSite=lax`, `httpOnly`, `secure` in production. Missing/invalid cookie → highest-q `Accept-Language` entry (ties keep header order; `q=0` entries are excluded) whose primary tag is `es` or `en` → else `en`.
- English output must remain identical to today for English users (every `en` value is the exact current string).
- Spanish: Spain Spanish, informal **tú**, sentence case (no Title Case), same punctuation conventions as the English source (keep trailing periods/ellipses).
- Glossary (binding, both directions):

| en | es |
|---|---|
| Dashboard | Panel |
| Article / Articles | Artículo / Artículos |
| Keyword(s) | Palabra(s) clave |
| Calendar | Calendario |
| Analytics | Analítica |
| Settings | Ajustes |
| Team | Equipo |
| Billing | Facturación |
| Workspace | Espacio de trabajo |
| Site | Sitio |
| Draft / Published | Borrador / Publicado |
| Publish / Unpublish | Publicar / Despublicar |
| Schedule(d) | Programar / Programado |
| Generate | Generar |
| Save / Cancel / Delete | Guardar / Cancelar / Eliminar |
| Sign out | Cerrar sesión |
| Cover image | Imagen de portada |
| Excerpt | Extracto |
| SEO title / Meta description | Título SEO / Metadescripción |
| Auto-publish | Publicación automática |
| API key | Clave API |
| Reverse proxy / Static export | Proxy inverso / Exportación estática |
| Social posts | Publicaciones en redes |
| Translation | Traducción |
| Trial | Prueba |
| Brand DNA, Search Console, Widget, Slug, RSS, DIYSEO, Facebook, Instagram, X, LinkedIn, Stripe | unchanged (proper names) |

- Out of scope: the public landing `app/page.tsx` and `components/landing/*` (a Spanish landing worth indexing needs its own URL and hreflang — separate decision; consenso 2026-11-23), `/admin` (operator-only), `app/privacy` and `app/terms` (legal text needs a human), outgoing emails (`lib/invite-email.ts`, recipient locale unknown), AI prompts and AI-generated content, public API / `embed.js` / blog (phase 1), `castelo-marketing` and other suite apps.
- `<html lang>` in `app/layout.tsx` becomes `await getUiLocale()` (cookies + headers only, no DB; signed-in pages are already dynamic). Public blog pages keep their `<main lang>` from phase 1, which overrides it for the content. This avoids Chrome's "translate from English?" prompt for Spanish users.
- Dates: `formatDate`/`formatNumber` only swap the locale; they don't add or change `timeZone`, so client components keep exactly today's server/client behavior.
- Deliveries (each ends green, consenso on its diff, then deploy on the user's go): **D1** Tasks 1–3, **D2** Tasks 4–7, **D3** Tasks 8–10.

## Review Focus

1. Accept-Language variants: `es-ES,es;q=0.9`, `es-419`, `en-GB,es;q=0.8`, `fr-FR,es;q=0.5`, `en;q=0.5,es;q=0.9`, `es;q=0,en;q=0.1`, `*`, empty, garbage → `es`, `es`, `en`, `es`, `es`, `en`, `en`, `en`, `en` (Task 1 test).
2. Tampered cookie (`diyseo-locale=de`, `=ES`, `=<script>`) → ignored, falls through to Accept-Language; the switcher action rejects anything but `en`/`es` (Task 1 tests).
3. A Zod/lib error string with no catalog entry → shown verbatim in English, never a blank or a key path; every message Zod can actually emit from our schemas (custom and default) is in the catalog (Task 1 tests).
4. Interpolated strings with a missing variable → leave `{name}` visible rather than throw; extra vars ignored (Task 1 test).
5. Client component rendered outside any provider (existing unit tests, Storybook-like renders) → English, no throw (Task 1 test).

---

### Task 1: i18n core, switcher, guard test

**Files:**
- Create: `lib/i18n/locale.ts`, `lib/i18n/messages/en.ts`, `lib/i18n/messages/es.ts`, `lib/i18n/translate.ts`, `lib/i18n/server.ts`, `lib/i18n/actions.ts`, `components/i18n-provider.tsx`, `components/locale-switcher.tsx`
- Modify: `app/layout.tsx` (`<html lang={await getUiLocale()}>`)
- Test: `tests/i18n-core.test.ts`, `tests/i18n-raw-text.test.ts`, `tests/i18n-validation-messages.test.ts`

**Interfaces (Produces):**
- `lib/i18n/locale.ts` (pure, no Next imports):
  - `type UiLocale = "en" | "es"`; `UI_LOCALE_COOKIE = "diyseo-locale"`
  - `isUiLocale(value: unknown): value is UiLocale`
  - `resolveUiLocale(input: { cookie?: string | null; acceptLanguage?: string | null }): UiLocale`
  - `intlLocale(locale: UiLocale): "en-US" | "es-ES"`
- `lib/i18n/messages/en.ts`: `export const en = { common: {...}, nav: {...}, errors: {...}, ... } as const` — nested namespaces, string leaves only. Task 1 seeds `common`, `nav` (sidebar labels), `localeSwitcher` (`label`, `en: "English"`, `es: "Español"`) and `errors` (every message in `lib/validations.ts`, see test below). Later tasks add one namespace each.
- `lib/i18n/messages/es.ts`: `export const es: Messages = {...}` where `type Messages = DeepStrings<typeof en>` (same keys, `string` leaves) — key parity is enforced by `tsc`.
- `lib/i18n/translate.ts` (pure):
  - `type MessageKey` = union of dotted leaf paths of `typeof en`.
  - `createT(locale: UiLocale): T` where `type T = (key: MessageKey, vars?: Record<string, string | number>) => string`. `{var}` placeholders replaced; missing var leaves `{var}`.
  - `createLocalizeMessage(locale: UiLocale): (message: string | null | undefined) => string` — exact-match reverse lookup of `message` among `en.errors` leaf values only (the closed catalog) → same key in `locale`; no match → `message` unchanged; null/undefined → `""`.
  - `formatDate(date: Date | string, locale: UiLocale, options: Intl.DateTimeFormatOptions): string`, `formatNumber(value: number, locale: UiLocale, options?: Intl.NumberFormatOptions): string`.
- `lib/i18n/server.ts` (`import "server-only"`, as `lib/mailer.ts` does): `getUiLocale(): Promise<UiLocale>` (reads `cookies()` + `headers()`), `getT(): Promise<T>`, `getLocalizeMessage(): Promise<(m) => string>`.
- `lib/i18n/actions.ts` (`"use server"`): `setUiLocale(formData: FormData): Promise<void>` — reads `locale`, ignores non-`UiLocale`, sets the cookie per Global Constraints, `revalidatePath("/", "layout")`.
- `components/i18n-provider.tsx` (`"use client"`): `I18nProvider({ locale, children })` — builds `createT(locale)` client-side (dictionaries are imported statically by the client bundle; only signed-in layouts mount it). `useT(): T`, `useLocale(): UiLocale`, `useLocalizeMessage()`. Context default = English, so renders without a provider stay English.
- `components/locale-switcher.tsx` (`"use client"`): two-option `<select>` inside a `<form action={setUiLocale}>` that submits on change (`requestSubmit()`); labels from `localeSwitcher.*`; current value from `useLocale()`. No optimistic client update: the server action's revalidation re-renders server and client parts together.
- `tests/i18n-raw-text.test.ts` exports nothing; holds `const MIGRATED_FILES: string[] = []` and an allowlist `ALLOWED_TEXT = ["DIYSEO", "Brand DNA", "Search Console", "RSS", "Atom", "robots.txt", "Facebook", "Instagram", "X", "LinkedIn", "Stripe", "Google", "·", "→", "←", "©"]`. It parses each listed file with the TypeScript compiler API (`ts.createSourceFile`, `ScriptKind.TSX`; `typescript` is already a devDependency) and collects: `JsxText` nodes, and string-literal values of the JSX attributes `placeholder`, `title`, `aria-label`, `alt`, `label`, `description` — skipping anything inside `<pre>`, `<code>` or `<kbd>` elements. It fails listing every collected text that, after removing allowlisted terms, still contains a latin word of ≥3 letters. Object-literal UI copy outside JSX (e.g. a `sections` array) is moved into the dictionary by the task anyway; the visual check catches leftovers.

- [ ] **Step 1: Write failing tests** `tests/i18n-core.test.ts`:
  - `resolveUiLocale` table: cookie `"es"` + AL `"en-US"` → `es`; cookie `"en"` + AL `"es-ES"` → `en`; cookie `"de"`/`"ES"`/`"<script>"` + AL `"es-ES,es;q=0.9"` → `es`; no cookie + AL cases from Review Focus 1 → exactly those results.
  - `createT("es")("nav.dashboard") === "Panel"`; `createT("en")("nav.dashboard") === "Dashboard"`.
  - interpolation: a seeded key `common.greeting = "Hello, {name}"` → `createT("en")("common.greeting", { name: "Ana" }) === "Hello, Ana"`; without vars → `"Hello, {name}"`. (Remove `common.greeting` only if no later task uses it — keep it as the interpolation fixture.)
  - `createLocalizeMessage("es")` of an exact `en.errors.*` value returns the `es` value; of `"Some unknown error"` returns it unchanged; of `undefined` returns `""`.
  - `formatDate(new Date("2026-11-23T12:00:00Z"), "es", { dateStyle: "long" }) === "23 de noviembre de 2026"` (file starts with `process.env.TZ = "UTC"`).
  - Rendering `LocaleSwitcher` and a tiny `useT` consumer with `renderToStaticMarkup` and no provider yields English labels (pattern: `tests/public-blog-header.test.ts`, React global for JSX).
- [ ] **Step 2: Write failing** `tests/i18n-validation-messages.test.ts`:
  - **Coverage of emitted messages:** for every Zod schema exported from `lib/validations.ts`, `safeParse` each of `{}`, `null`, `{ <every key>: "" }`, `{ <every key>: 123 }` and `{ <every key>: "x".repeat(5000) }` (keys from `schema.shape` when it's an object schema; skip non-object schemas with a comment), collect every `issue.message`, and assert each is an `en.errors` value. This covers custom literals and Zod defaults ("Required", "Expected string, received number", …) alike.
  - **Uniqueness:** no two `en.errors` keys share the same English value.
  - Also `tests/i18n-raw-text.test.ts` as described, with `MIGRATED_FILES = ["components/locale-switcher.tsx", "components/sidebar-nav.tsx"]`.
- [ ] **Step 3:** `npx tsx --test tests/i18n-*.test.ts` → FAIL (modules missing; sidebar has raw text).
- [ ] **Step 4:** Implement the modules above; add every `lib/validations.ts` message to `en.errors` (keys named by meaning, e.g. `errors.contentLanguageRequired`) with Spanish in `es.errors`; migrate `components/sidebar-nav.tsx` labels to `useT()`/`nav.*` (it's a client component — check; if server, `getT()`).
- [ ] **Step 5:** `npx tsx --test tests/i18n-*.test.ts` → PASS; `npx tsc --noEmit` clean; `npm test` green.
- [ ] **Step 6:** Commit `feat(i18n): locale resolution, en/es dictionaries, translator and switcher`.

### Migration recipe (Tasks 2–11)

Every migration task follows the same steps; each task's text only lists its files, namespace and anything special.

1. **RED:** append the task's files to `MIGRATED_FILES` in `tests/i18n-raw-text.test.ts`; run `npx tsx --test tests/i18n-raw-text.test.ts` → FAIL listing the raw strings.
2. Add the task's namespace to `en.ts` (exact current English) and `es.ts` (Spanish per Global Constraints/glossary).
3. Server components/pages: `const t = await getT();`. Client components: `const t = useT();`. Server actions and route handlers that return user-visible `error`/`message` text: their own literals become `t(key, vars)`; strings coming from Zod issues or static `lib/*` errors go through `localizeMessage` (add any missing static lib error to `en.errors`). **Inventory dynamic errors:** for each touched action/route, list the lib errors that embed runtime values (counts, names, URLs); map each to `t(key, vars)` in the action (match by the lib's error code/shape, not by string) and add a test for each mapping in `tests/i18n-dynamic-errors.test.ts` when the mapping is a pure function. Client components that display `state.error` or `payload.error` from fetch: pass through `useLocalizeMessage()` as a second line of defense.
4. Dates/numbers/currency in these files: replace hard-coded `"en-US"`/`undefined` locales with `formatDate`/`formatNumber` and the active locale. Relative phrases ("3 days left") become dictionary entries with `{count}`; use separate `*One`/`*Other` keys chosen with `count === 1`.
5. `metadata`/`generateMetadata` titles in these pages: translate via `getT()` inside `generateMetadata` (convert a static `metadata` export to `generateMetadata` when needed).
6. **GREEN:** raw-text test passes; `npx tsc --noEmit` clean; `npm test` green.
7. **Visual check:** dev server (throwaway DB as in phase 1 if `.env.local`'s DB isn't this project's) signed in, each touched screen once with cookie `diyseo-locale=es` and once `=en`: no English left in es (except glossary proper names), en identical to before, no layout overflow from longer Spanish strings (buttons, sidebar, badges).
8. Commit `feat(i18n): <area> in Spanish and English`.

### Task 2 (D1): App shell, switcher placement, onboarding

**Files:** `app/[siteId]/layout.tsx` (mount `I18nProvider`; add `<LocaleSwitcher />` above the sign-out button), `components/site-selector.tsx`, `components/auth-buttons.tsx`, `components/page-header.tsx`, `components/empty-state.tsx`, `components/blog-only.tsx`, `components/standalone-page.tsx`, `components/satellite-page.tsx`, `app/new-site/page.tsx`, `components/create-site-form.tsx`, `app/invite/[token]/page.tsx`, `app/auth/continue/page.tsx`, `app/sso/login/page.tsx`, `app/not-found.tsx`, `app/team/page.tsx`, `app/billing/page.tsx` (redirect-only pages: skip if no visible text). Namespaces: `shell`, `onboarding`, `invite`.
- Top-level pages outside `app/[siteId]` that render client components with text (`new-site`, `invite`) also mount `I18nProvider` (via a shared server helper `components/app-i18n.tsx`: `AppI18n({ children })` = `getUiLocale()` + provider; use it in the `[siteId]` layout too).
- The header line "Self-hosted SEO workspace" / "Managing {name}" goes in `shell`.

### Task 3 (D1): Site dashboard and install methods

**Files:** `app/[siteId]/page.tsx`, `components/widget-install-card.tsx`, `components/install-reverse-proxy-panel.tsx`, `components/install-static-export-panel.tsx`, `components/seo-performance-section.tsx`, plus the user-visible error strings of `app/api/internal/sites/[siteId]/verify-proxy/route.ts` and `.../export/route.ts` (localize via `getLocalizeMessage()`; status codes and JSON shape unchanged). Namespaces: `dashboard`, `install`.
- Generated proxy config text (`lib/install-methods/proxy-configs.ts`) and code snippets stay as-is (they are code, not UI).
- **D1 ends here:** consenso on the D1 diff, deploy on the user's go, check prod with `es` and `en` cookies.

### Task 4 (D2): Brand DNA

**Files:** `app/[siteId]/brand-dna/page.tsx`, `components/brand-dna-form.tsx` (section titles/descriptions/field labels move to `brandDna.*`; the `sections` const becomes a function of `t` or keeps keys and resolves at render), the Brand DNA generation route/action error text. Namespace: `brandDna`.

### Task 5 (D2): Article list, create, generate, preview

**Files:** `app/[siteId]/articles/page.tsx`, `app/[siteId]/articles/new/page.tsx`, `components/article-create-form.tsx`, `components/article-generation-form.tsx`, `components/article-keyword-assignment.tsx`, `components/article-status-toggle.tsx`, `components/article-delete-button.tsx`, `app/[siteId]/preview/page.tsx` (the admin preview mirrors the public blog: use `lib/public-blog-i18n.ts` with the site's content language for the blog-chrome part, `getT()` only for the preview's own app chrome), and the article-related returns in `lib/actions.ts`. Namespace: `articles`.

### Task 6 (D2): Article editor, translations, social posts

**Files:** `app/[siteId]/articles/[articleId]/page.tsx`, `components/article-editor-form.tsx`, `components/article-translation-form.tsx`, `components/social-posts-panel.tsx`, user-visible returns in `lib/social-actions.ts`. Namespaces: `editor`, `social`.
- `lib/translations.ts` `TRANSLATION_LANGUAGE_OPTIONS` labels: show them via `new Intl.DisplayNames([intlLocale(locale)], { type: "language" }).of(code)` with the existing English label as fallback (fixes phase-1 deferred minor "Traducción: English" only inside the app; the public blog keeps its own rule).
- Social post status names (DRAFT/PUBLISHING/PUBLISHED/FAILED/UNKNOWN) get `social.status.*` keys; enum values themselves don't change.

### Task 7 (D2): Keywords and calendar

**Files:** `app/[siteId]/keywords/page.tsx`, `components/create-keyword-form.tsx`, `components/suggested-keywords.tsx`, `app/[siteId]/calendar/page.tsx`, `components/calendar-month-view.tsx` (weekday/month names from `Intl.DateTimeFormat(intlLocale(locale), { weekday: "short" })`; week still starts on the current weekday — don't change week start in this task), keyword-related returns in `lib/actions.ts`. Namespaces: `keywords`, `calendar`.
- **D2 ends here:** consenso, deploy on go, prod check.

### Task 8 (D3): Site settings and API page

**Files:** `app/[siteId]/settings/page.tsx`, `components/site-search-locale-form.tsx`, `components/site-translation-settings-form.tsx`, `components/site-auto-publish-form.tsx`, `components/site-delete-form.tsx` (the typed confirmation word, if any, stays what the server validates — translate only the instruction around it), `components/site-transfer-form.tsx`, `components/site-publishing-api-keys-form.tsx`, `components/site-social-connection-form.tsx`, `components/search-console-property-picker.tsx`, `app/[siteId]/api/page.tsx`, remaining site-settings returns in `lib/actions.ts`. Namespace: `settings`, `apiKeys`.

### Task 9 (D3): Analytics, SEO data, Ads

**Files:** `app/[siteId]/analytics/page.tsx`, `app/[siteId]/analytics/loading.tsx`, `app/[siteId]/seo-data/[[...slug]]/page.tsx`, `app/[siteId]/ads/[[...slug]]/page.tsx`. Namespace: `analytics`. Numbers/percentages via `formatNumber`.

### Task 10 (D3): Billing and team

**Files:** `app/[siteId]/billing/page.tsx`, `components/billing-page-content.tsx`, `components/billing-plan-picker.tsx`, `app/[siteId]/team/page.tsx`, `components/team-page-content.tsx`, `components/team-forms.tsx`, user-visible returns in `lib/billing-actions.ts` and team actions. Namespaces: `billing`, `team`. Prices keep their currency; format via `formatNumber(..., { style: "currency", currency })`. Plan names (from `lib/plans.ts`) are product names: unchanged.
- Last step of Task 10: turn `MIGRATED_FILES` into a scan of every `.tsx` under `app/` and `components/` with an `IGNORED_FILES` list (admin, blog, landing, privacy, terms, `public-blog-*`, `blog-only.tsx` if it has no text), so new screens are audited automatically. Update CLAUDE.md (one paragraph under Architecture: i18n layer, cookie, how to add a string, the raw-text guard) and memory.
- **D3 ends here:** consenso, deploy on go, prod check.
