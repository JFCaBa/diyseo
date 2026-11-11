# SEO attribution install methods: reverse proxy and static export

Date: 2026-11-11. Scope: hub (`components/widget-install-card.tsx` and new routes). Approved by the user in chat.

## Intent
The install card lists "Reverse proxy" and "Static export" as placeholders. Make them real, with the least work for the client. Both serve the blog under the client domain (`https://client.com/blog`) so Google attributes the articles to the client domain.

## Current state
- Reverse proxy already works technically: `lib/public-urls.ts` serves tenant URLs (canonical, og:url, feeds) when `x-forwarded-host` differs from the app host; `next.config.ts` `assetPrefix` points assets to the app origin. Only a copy-paste Cloudflare Worker exists, inline in the card.
- Static export does not exist.

## Goals
1. **Reverse proxy:** platform selector (Cloudflare Worker, Nginx, Apache) with a ready-to-paste config containing the site ID and origin; a **Verify** button that checks the client domain really serves this site and, when it passes, records it and marks the site installed.
2. **Static export:** a **Download ZIP** button producing a `blog/` folder the client uploads to their hosting; the card shows when the last export was made and how many articles were published or updated since.

## Non-goals
- Vercel/Netlify snippets (forwarding of `x-forwarded-host` unverified).
- Automatic upload (FTP/SFTP/Git): needs client credentials, later phase.
- Translations (`?lang=`) in the export: default language only.
- Exporting `robots.txt` (the client owns theirs).

## Anti-goals
- Verify must never become an SSRF primitive: `SiteProject.domain` is user-controlled, and the server fetches it.
- A static export must not depend on hashed assets of the hub (they disappear on each hub deploy): CSS inlined, no scripts.
- No change to the public pages' behavior for existing proxy clients.

## Decisions
- Verify: HTTPS to `https://<host>/blog`, no redirects followed, 8 s timeout, 1 MB body cap, address validated at connect time (public IPs only), hostname must be a plain DNS name (no IP literal, port, `localhost`, `.local`, `.internal`). Success needs HTTP 200 **and** `<meta name="diyseo-site" content="<siteId>">` **and** a canonical on the client host. Each failure gets a specific message (unreachable, 404 = route not attached, redirect, not a DIYSEO page = client has its own /blog, canonical on diyseo.online = forwarded host not set).
- Marker: the blog index page emits `<meta name="diyseo-site">` so another site's `/blog` is not mistaken for ours.
- Export: server fetches its own public pages with `x-forwarded-host: <client host>`, so the HTML is byte-for-byte what the proxy would serve. Stylesheets inlined; every `<script>` and script preload removed except `application/ld+json`. Files: `blog/index.html`, `blog/<slug>/index.html`, `blog/sitemap.xml`, `blog/rss.xml`, `blog/atom.xml`, `README.txt`. Cap 500 articles; any non-200 page aborts the export with an error (no partial ZIP).
- Both routes: POST, session + workspace scoped via `denyUnlessSiteOwner`.
- Data: two nullable columns on `SiteProject`: `proxyVerifiedAt`, `staticExportedAt`. "Changes since export" = published articles with `updatedAt > staticExportedAt` (or never exported). Verify success also sets `widgetInstalledAt` when null (the onboarding checklist step).
- New dependency: `fflate` (zip).

## Left to the builder
Exact wording of messages and the layout inside the card.
