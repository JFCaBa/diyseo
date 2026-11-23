# Public blog in the site's content language — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The public blog chrome (index, article page, tenant header, footer links, feeds, embed widget) shows its fixed texts and dates in the site's content language — Spanish for `es` sites, English otherwise.

**Architecture:** One pure module `lib/public-blog-i18n.ts` resolves `BrandProfile.contentLanguage` to a blog locale (`"en" | "es"`) and holds both string dictionaries plus a date formatter. `getPublicSite` also returns `contentLanguage`; each blog page/route resolves the locale once and passes strings down. `public/embed.js` gets its own small in-file dictionary keyed by the `contentLanguage` it already receives from `/api/public/sites/:siteId/config`.

**Tech Stack:** Next.js 15 App Router, React 19 server components, Prisma, `node:test` via `tsx`.

**Spec:** Agreed scope in memory `project_ui_spanish.md` (2026-11-20, phase 1 = public blog). No separate design doc.

## Global Constraints

- No locale prefix in URLs; no new query parameters. The existing `?lang=` translation parameter keeps its current meaning.
- Public API response shape and `embed.js` `data-*` attribute contract unchanged (no new/renamed fields in `/api/public/...`).
- Locale comes only from `BrandProfile.contentLanguage` (prod values today: `en` ×7, `es` ×5; the Brand DNA field is free text, so names like `Spanish`/`Español` must also resolve).
- Unknown, empty or null language → English (current behavior, byte-for-byte for English sites except the added `lang`/`<language>` attributes).
- Out of scope: the platform-wide `/blog` index and `/blog/{rss,atom,sitemap}.xml` aggregate routes, `/blog/widget-demo`, the signed-in workspace (phase 2), article bodies (already in the content language).
- `<html lang>` stays `en` (single static root layout); language is declared on `<main>`, `og:locale` and feeds. Dynamic `<html lang>` would need route-group root layouts or a dynamic root layout — deferred as tech debt (agreed in consenso 2026-11-23).
- Article translation view (`?lang=xx`): chrome follows the *site* locale, not the translation language (only en/es dictionaries exist). The "Viewing translation: xx" line is translated with the language label.

## Review Focus

1. `contentLanguage` = `"Spanish"`, `"español"`, `"ES"`, `"es-ES"`, `" es "` → must all render Spanish (Task 1 test).
2. `contentLanguage` = `null` / `""` / `"fr"` / garbage → English, never a throw (Task 1 test).
3. Spanish date reads `23 de noviembre de 2026` (lowercase month, `de`). No `timeZone` option is added, matching today's English formatting so existing dates don't shift; the test uses a midday-UTC date so it passes in any server TZ (Task 1 test).
4. Site with no BrandProfile row (`brandProfile: null`) → English, page renders (Task 2: `getPublicSite` returns `contentLanguage: string | null` flattened, never undefined access).
5. Embed widget receiving `contentLanguage: "Spanish"` (free text) → `Intl.DateTimeFormat("Spanish")` throws RangeError today and falls back; Spanish strings must still be chosen by the same resolution rule (Task 4).

---

### Task 1: Locale resolver, dictionaries, date formatter

**Files:**
- Create: `lib/public-blog-i18n.ts`
- Create: `tests/fixtures/blog-locale-cases.ts`
- Test: `tests/public-blog-i18n.test.ts`

**Interfaces:**
- Produces:
  - `type BlogLocale = "en" | "es"`
  - `resolveBlogLocale(contentLanguage: string | null | undefined): BlogLocale` — trim + lowercase; `es` if value is `es`, starts with `es-`/`es_`, or starts with one of the words `spanish`, `español`, `espanol`, `castellano` (so `Spanish (Spain)`, `Español - España` resolve); else `en`.
  - `BLOG_LOCALE_CASES: ReadonlyArray<[input: string | null, expected: BlogLocale]>` — exported from `tests/fixtures/blog-locale-cases.ts` (not from lib), the shared table that both the TS resolver and the embed.js copy are tested against (Task 4).
  - `getBlogStrings(locale: BlogLocale): BlogStrings`
  - `formatBlogDate(date: Date | string, locale: BlogLocale): string` — coerce strings with `new Date(date)` first, then `Intl.DateTimeFormat(locale === "es" ? "es-ES" : "en-US", { year: "numeric", month: "long", day: "numeric" })`.
  - `blogHtmlLang(locale) → "es" | "en"`, `blogOgLocale(locale) → "es_ES" | "en_US"`.
  - `BlogStrings` fields (exact copy; `{name}` / `{date}` / `{language}` are function params):

| key | en (current text, unchanged) | es |
|---|---|---|
| `blogTitle(name)` | `${name} Blog` | `Blog de ${name}` |
| `indexDescription(name)` (meta) | `Read the latest articles and updates from ${name}.` | `Lee los últimos artículos y novedades de ${name}.` |
| `eyebrow` | `Public Blog` | `Blog` |
| `indexIntro(name)` | `Published articles from ${name}, served directly from the DIYSEO app.` | `Artículos publicados por ${name}.` |
| `emptyTitle` | `No articles published yet.` | `Todavía no hay artículos publicados.` |
| `emptyBody` | `Check back later for new posts from this site.` | `Vuelve pronto para leer las nuevas publicaciones.` |
| `backToBlog` | `← Back to Blog` | `← Volver al blog` |
| `backToIndex` | `Back to Blog Index` | `Volver al índice del blog` |
| `previous` / `next` | `Previous` / `Next` | `Anterior` / `Siguiente` |
| `articleNavLabel` | `Article navigation` | `Navegación entre artículos` |
| `published(date)` | `Published ${date}` | `Publicado el ${date}` |
| `viewingTranslation(language)` | `Viewing translation: ${language}` | `Traducción: ${language}` |
| `headerBlogLink` | `Blog` | `Blog` |
| `sitemapLabel` | `Sitemap` | `Mapa del sitio` |
| `feedDescription(name)` | `Latest articles from ${name}` | `Últimos artículos de ${name}` |

(RSS, Atom, robots.txt labels stay as-is in both.) Spanish `indexIntro` drops the "served from DIYSEO app" phrase on purpose: readers shouldn't see the vendor.

- [ ] **Step 1: Write failing tests** in `tests/public-blog-i18n.test.ts` (first line: `process.env.TZ = "UTC";` so date tests don't depend on the machine TZ; production code sets no `timeZone`):
  - `BLOG_LOCALE_CASES` contains → `"es"`: `"es"`, `"ES"`, `" es "`, `"es-ES"`, `"es_MX"`, `"Spanish"`, `"Spanish (Spain)"`, `"español"`, `"Español - España"`, `"Espanol"`, `"castellano"`; → `"en"`: `null`, `""`, `"en"`, `"fr"`, `"estonian"`, `"English"`, `"spa"`. The test loops the table asserting `resolveBlogLocale(input) === expected`, plus `resolveBlogLocale(undefined) === "en"`.
  - `formatBlogDate(new Date("2026-11-23T12:00:00Z"), "es") === "23 de noviembre de 2026"`; `"en"` → `"November 23, 2026"`; `formatBlogDate("2026-11-23T12:00:00Z", "es")` gives the same Spanish string.
  - `getBlogStrings("es").blogTitle("Fisio Ruzafa") === "Blog de Fisio Ruzafa"`; `getBlogStrings("en").blogTitle("X") === "X Blog"`; every key in `en` exists in `es` (`assert.deepEqual(Object.keys(es).sort(), Object.keys(en).sort())`).
- [ ] **Step 2:** `npx tsx --test tests/public-blog-i18n.test.ts` → FAIL (module not found).
- [ ] **Step 3:** Implement `lib/public-blog-i18n.ts` per the interface above.
- [ ] **Step 4:** Same command → PASS.
- [ ] **Step 5:** Commit `feat(blog): locale resolver and en/es strings for the public blog`.

### Task 2: Index page, article page, header and footer in the site locale

**Files:**
- Modify: `lib/articles.ts` (`getPublicSite`, `getPublishedArticleBySlugWithTranslation` select)
- Modify: `app/blog/[siteId]/page.tsx`, `app/blog/[siteId]/[slug]/page.tsx`
- Modify: `components/public-blog-header.tsx` (new prop `blogLabel?: string`, default `"Blog"`), `components/public-blog-meta-links.tsx` (new prop `sitemapLabel?: string`, default `"Sitemap"`)
- Test: `tests/public-blog-header.test.ts` (extend). Meta links call `getPublicUrls` (request headers + DB), so their label is covered by Task 3's manual check, not a unit test.

**Interfaces:**
- Consumes: Task 1 exports.
- Produces: `getPublicSite(siteId)` returns the existing fields plus `contentLanguage: string | null` (select `brandProfile: { select: { contentLanguage: true } }` and flatten in the function; callers in `app/[siteId]/preview/page.tsx` and sitemap ignore it).

- [ ] **Step 1:** Extend header test: rendering with `blogLabel: "Blog"` keeps the existing assertions; add a case asserting the label prop is what's rendered (`blogLabel: "Blog-ES"` → `/href="\/blog"[^>]*>Blog-ES</`).
- [ ] **Step 2:** Run `npx tsx --test tests/public-blog-header.test.ts` → FAIL.
- [ ] **Step 3:** Implement:
  - `getPublicSite` change above.
  - Index page: `const locale = resolveBlogLocale(site.contentLanguage); const t = getBlogStrings(locale);` replace every literal from the Task 1 table; dates via `formatBlogDate`; `lang={blogHtmlLang(locale)}` on `<main>`; metadata `title`/`description` from `t`, `openGraph.locale = blogOgLocale(locale)`.
  - Article page: add `brandProfile: { select: { contentLanguage: true } }` inside the `siteProject` select of `getPublishedArticleBySlugWithTranslation`, and in both `generateMetadata` and the page resolve `resolveBlogLocale(article.siteProject?.brandProfile?.contentLanguage)` (one source for both; the page keeps calling `getPublicSite` for domain/proxy redirect as today). Replace literals; `viewingTranslation(getTranslationLanguageLabel(language))`; `aria-label={t.articleNavLabel}`; `lang` on `<main>`; `openGraph.locale`.
  - Pass `blogLabel={t.headerBlogLink}` and `sitemapLabel={t.sitemapLabel}`.
- [ ] **Step 4:** `npm test` → all PASS; `npx tsc --noEmit` → no errors.
- [ ] **Step 5:** Commit `feat(blog): public index and article pages in the site's content language`.

### Task 3: Feeds carry the language

**Files:**
- Modify: `app/blog/[siteId]/rss.xml/route.ts`, `app/blog/[siteId]/atom.xml/route.ts`

- [ ] **Step 1:** RSS: channel `<title>` = `t.blogTitle(site.name)`, `<description>` = `t.feedDescription(site.name)`, add `<language>${blogHtmlLang(locale)}</language>` after `<link>`. Atom: `<title>` = `t.blogTitle(site.name)`, add `<subtitle>` = `t.feedDescription(site.name)` (CDATA), add `xml:lang="${blogHtmlLang(locale)}"` to `<feed>`.
- [ ] **Step 2: Manual verification** (dev server with a seeded `es` site and an `en` site): `curl -s localhost:3000/blog/<esSiteId>/rss.xml | grep -o '<language>es</language>'` prints a match; `curl -s localhost:3000/blog/<esSiteId>` contains `Blog de` and `lang="es"`; the `en` site's index HTML still contains `Public Blog` and `No articles published yet.` / dates in `November` format.
- [ ] **Step 3:** Commit `feat(blog): feed titles and language tag follow the site language`.

### Task 4: Embed widget strings

**Files:**
- Modify: `public/embed.js`
- Test: `tests/embed-locale.test.ts`

**Interfaces:**
- Consumes: `widgetConfig.contentLanguage` (already resolved from the config API, line ~397). No API or attribute change.

- [ ] **Step 0: Failing test** `tests/embed-locale.test.ts`: read `public/embed.js`, extract the text between `// resolveLocale:start` and `// resolveLocale:end`, build it with `new Function(src + "; return resolveLocale;")()`, and loop `BLOG_LOCALE_CASES` asserting each expected value (null passed as-is). Fails until the markers exist. (Consenso: shared expectations table, real function, no test-only export.)
- [ ] **Step 1:** Add an in-file `resolveLocale(value)` between those marker comments, with the same rule as `resolveBlogLocale` (duplicated deliberately: the script is standalone ES5 with no imports — use `indexOf(...) === 0`, not `startsWith`; no `const`/arrows) and a `STRINGS = { en: {...}, es: {...} }` covering the six reader-visible messages: `Loading articles...` → `Cargando artículos...`, `No published articles are available yet for {name}.` → `Todavía no hay artículos publicados de {name}.`, `Unable to load articles right now.` → `No se han podido cargar los artículos.`, `Loading article...` → `Cargando artículo...`, `Article not found.` → `Artículo no encontrado.`, `Unable to load this article right now.` → `No se ha podido cargar este artículo.`, plus the default title `Articles` → `Artículos` (only when neither `data-title` nor siteName is set). Date formatting: pass `"es-ES"`/`"en-US"` from the resolved locale instead of the raw `contentLanguage`. `container.setAttribute("lang", ...)` uses the resolved code.
  - Note: "Loading articles..." renders before config arrives → keep English there unless `data-lang`… no new attribute: it stays English-or-previous; acceptable (brief flash).
- [ ] **Step 2: Manual verification:** open `/blog/widget-demo` (or a test HTML page) pointing at an `es` site; the list shows Spanish dates (`23 de noviembre de 2026`) and Spanish empty/error states (point at a site with no published articles). `node --check public/embed.js` passes and `npx tsx --test tests/embed-locale.test.ts` passes.
- [ ] **Step 3:** Commit `feat(embed): widget messages and dates in the site language`.

### Task 5: Docs + memory

- [ ] README/CLAUDE.md: one line under "Public blog + widget feed": chrome language comes from `BrandProfile.contentLanguage` via `lib/public-blog-i18n.ts` (en/es; others → en).
- [ ] Commit with Task 4 or separately (docs-only).
- [ ] Before the final commit/push: consenso on the full diff (global rule), `npm test` green (no deploy without tests).
