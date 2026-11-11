# SEO install methods Implementation Plan

> For agentic workers: implement task by task, TDD, commit per task.

**Goal:** make Reverse proxy and Static export real install methods in the hub.
**Spec:** `docs/superpowers/specs/2026-11-11-seo-install-methods-design.md`
**Tech:** Next.js 15, Prisma, `node:test` via `tsx` (`npm test`), `fflate`.

## Global constraints
- Tests are `tests/*.test.ts` (node:test). Never run `npm run lint`.
- The literal `ownerId` is forbidden in `app/` and `lib/` (tests/no-owner-scoping.test.ts).
- UI copy in English, existing Tailwind classes of the card.

## Review focus
- SSRF: IP literals, `localhost`, ports, private/link-local/CGNAT/IPv6-mapped addresses, DNS rebinding, redirects.
- Export when the site has 0 published articles, a slug with odd characters, or one page returns non-200.
- Verify against a client that has its own WordPress `/blog` (must fail with "not a DIYSEO page").

## Task 1: Proxy config builders
Files: create `lib/install-methods/proxy-configs.ts`, test `tests/install-proxy-configs.test.ts`.
Produces: `buildWorkerScript({origin, siteId}): string` (the existing Worker text moved out of the card, unchanged), `buildNginxConfig({origin, siteId, clientHost?}): string`, `buildApacheConfig({origin, siteId}): string`.
Tests: each output contains the site ID and the origin host; Nginx has `proxy_set_header X-Forwarded-Host $host`, `proxy_ssl_server_name on`, `rewrite ... break` for `/blog` and `/blog/<slug>`; Apache has `[P,L]` rules and `SSLProxyEngine On`; no output contains an unreplaced `undefined`.

## Task 2: Domain helpers
Files: create `lib/install-methods/site-host.ts` (move `formatRouteDomain` out of the card as `formatSiteHost`), test `tests/install-site-host.test.ts`.
Produces: `formatSiteHost(value?: string|null): string` (host without scheme/path; `clientdomain.com` fallback), `isVerifiableHost(host: string): boolean` (DNS name with a dot, no IP literal, no port, not `localhost`, not `.local`/`.internal`/`.localhost`).

## Task 3: Proxy verification
Files: create `lib/install-methods/verify-proxy.ts`, test `tests/install-verify-proxy.test.ts`; modify `app/blog/[siteId]/page.tsx` (`generateMetadata` adds `other: { "diyseo-site": siteId }`).
Produces: `isPublicAddress(ip: string): boolean`; `evaluateProxyResponse({status, location?, body, host, siteId}): {ok: boolean; reason: ProxyFailure | null; message: string}`; `verifyProxy(host, siteId, deps?): Promise<ProxyResult>` using `node:https` with a `lookup` that rejects non-public addresses at connect time, `maxRedirects` 0, timeout 8 s, body cap 1 MB.
Tests: `isPublicAddress` false for 127.0.0.1, 10.x, 172.16-31, 192.168, 169.254.169.254, 100.64/10, 0.0.0.0, ::1, fe80::, fc00::, ::ffff:127.0.0.1; true for 93.184.216.34. `evaluateProxyResponse`: 200 + meta + canonical on host → ok; 404; 301; 200 without meta; 200 with meta but canonical on another host; meta for a different siteId.

## Task 4: Static export builder
Files: create `lib/install-methods/static-export.ts`, test `tests/install-static-export.test.ts`; add `fflate`.
Produces: `prepareStaticHtml(html: string, css: Map<string,string>): string` (inline `<link rel="stylesheet">` by href via the map, drop `<script>` except `application/ld+json`, drop `<link rel="preload" as="script">`); `buildExportZip(files: Record<string,string>): Uint8Array`; `exportPathForSlug(slug): string | null` (rejects slugs with `/`, `..`, empty); `buildReadme(host, builtAt): string`; `buildStaticExport({host, siteId, slugs, origin, fetchImpl}): Promise<Record<string,string>>` (fetches `${origin}/blog/${siteId}`, each article, the 3 feeds with `x-forwarded-host`, then CSS; throws `ExportError` on any non-200 or > 500 slugs).
Tests: scripts removed but JSON-LD kept; stylesheet inlined; unsafe slugs rejected; a non-200 page throws; zero slugs still yields index + feeds; zip round-trips with `unzipSync`.

## Task 5: Schema, routes and card UI
Files: modify `prisma/schema.prisma` (`proxyVerifiedAt`, `staticExportedAt`) + migration `prisma/migrations/20261111090000_add_install_methods/migration.sql` (hand-written, additive); create `app/api/internal/sites/[siteId]/verify-proxy/route.ts` and `.../export/route.ts` (POST, `denyUnlessSiteOwner`; verify stores `proxyVerifiedAt` and sets `widgetInstalledAt` when null; export streams the ZIP with `Content-Disposition: attachment`, stores `staticExportedAt` on success only); create `components/install-reverse-proxy-panel.tsx`, `components/install-static-export-panel.tsx`; modify `components/widget-install-card.tsx` (the two tiles become selectors, Cloudflare block moves into the proxy panel) and `app/[siteId]/page.tsx` (pass `proxyVerifiedAt`, `staticExportedAt`, `changedSinceExport`).
Tests: `tests/install-guards.test.ts` — both routes call `denyUnlessSiteOwner` (same style as `tests/admin-guards.test.ts`).
Verification: `npm test`, `npx tsc --noEmit`, `npx next build` succeed.

## Task 6: Docs
Modify `CLAUDE.md` (a short "Install methods" note: verify guard, export approach, marker meta).

## Amendments after consenso (codex + agy; opencode did not participate)
These override the task text above.
- **Task 1:** Apache config also sets `ProxyAddHeaders On`, `RequestHeader set X-Forwarded-Proto "https"` and lists required modules (proxy, proxy_http, ssl, rewrite, headers); tests assert them. Nginx/Apache rules already forward feeds (`/blog/rss.xml` maps to `/blog/<siteId>/rss.xml`) and the query string; add a test per feed path.
- **Task 3:** one absolute deadline (8 s) covering DNS, connect and body (request destroyed on expiry); follow at most ONE redirect, only when `Location` resolves to https on the same host (trailing-slash/scheme normalization), re-validated by the same guard.
- **Task 4:** 
  - Slugs must match `^[a-z0-9]+(?:-[a-z0-9]+)*$` and be ≤ 100 chars; otherwise the export aborts naming the slug. URL segment built with `encodeURIComponent`.
  - CSS is fetched only from `https` URLs under the configured app origin and path `/_next/static/`, no redirects; any other stylesheet href aborts the export.
  - Limits: 200 articles, 2 MB per response, 40 MB total, concurrency 4, 90 s overall deadline; abort before zipping when exceeded. One export at a time per site (in-memory lock, 429 otherwise).
  - After fetching the index, run the canonical/marker check from Task 3 on it; abort with "forwarded host not applied" if the canonical is not on the client host. Test: exported HTML never contains `/blog/<siteId>`.
  - Ruling (agy): keep the HTTP self-fetch; the app runs on a long-lived PM2 Node process, and it guarantees the export equals what the proxy serves. Ruling (agy): no link rewriting needed, tenant mode already emits `/blog/<slug>` and client-host canonicals.
- **Task 5:** `staticExportedAt` is the START of the export, persisted only after success; add `staticExportedCount Int?` (published articles included). "Changed since export" = never exported, or published count differs, or any published article has `updatedAt > staticExportedAt`. Ruling (agy): verify still sets `widgetInstalledAt` when null, because the onboarding step means "installed", whichever method.
