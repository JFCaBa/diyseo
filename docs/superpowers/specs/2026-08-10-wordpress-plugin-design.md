# DIYSEO Sync — WordPress Plugin Design

Date: 2026-08-10
Status: Approved for planning

## Purpose

DIYSEO generates and publishes SEO articles in its own workspace, exposing them either through a
minimal embeddable widget (`embed.js`) or its own public blog routes. Many users already run a real
WordPress site and want DIYSEO-generated content to live there as native posts (for real SEO
value — server-rendered, themeable, indexable — instead of a JS-embedded widget).

This plugin pulls `PUBLISHED` articles from a DIYSEO site and syncs them into WordPress as native
posts, on a schedule and on demand.

## Direction & data flow

DIYSEO → WordPress (pull). The plugin runs entirely inside WordPress and calls out to DIYSEO's
existing Publishing API v1. DIYSEO requires no code changes — the v1 API already supports
everything needed: cursor-paginated listing, `status` filter, `include=content`, and per-key auth
already surfaced in `Settings → API` (`app/[siteId]/api/page.tsx`).

```
DIYSEO (Next.js)                          WordPress (client site)
┌─────────────────────────┐               ┌───────────────────────────┐
│ GET /api/v1/sites/{id}/  │  HTTPS        │  diyseo-sync plugin       │
│   articles               │◄──────────────┤  - WP-Cron every N min    │
│  status=PUBLISHED        │  Bearer key   │  - "Sync now" button      │
│  include=content         │  or X-Api-Key │  - upserts native posts   │
│  cursor=...              │               └───────────────────────────┘
└─────────────────────────┘
```

`/api/v1` is already public through `middleware.ts` (guarded by its own API-key auth, not the
NextAuth session), so it's reachable server-to-server from WordPress with no other DIYSEO changes.

### API contract used (existing, unchanged)

- `GET /api/v1/sites/{siteId}/articles?status=PUBLISHED&include=content&limit=50&cursor=...`
  - Auth: `Authorization: Bearer <key>` or `X-Api-Key: <key>` (`diyseo_spk_...`, from
    `lib/site-publishing-api.ts`)
  - Response: `{ siteId, articles: [{ id, title, slug, excerpt, coverImageUrl, seoTitle,
    seoDescription, status, publishedAt, createdAt, updatedAt, publicUrl, editorUrl,
    contentMarkdown, contentHtml }], nextCursor }`

No new DIYSEO endpoints, schema changes, or auth changes are required for v1 of this plugin.
(Optional, non-blocking follow-up: link to the plugin from the `Publishing API` settings page.)

## Plugin layout

Lives in this repo at `wordpress-plugin/diyseo-sync/`, packaged/zipped by the user for WP install.

```
wordpress-plugin/diyseo-sync/
├── diyseo-sync.php                    # plugin header, bootstrap, activation/deactivation hooks
├── includes/
│   ├── class-diyseo-sync-settings.php # admin settings screen
│   ├── class-diyseo-sync-client.php   # HTTP client for the Publishing API
│   ├── class-diyseo-sync-engine.php   # sync algorithm: fetch, map, upsert, unpublish
│   ├── class-diyseo-sync-cron.php     # WP-Cron schedule registration + hook
│   └── class-diyseo-sync-seo.php      # Yoast/RankMath detection + meta mapping
├── uninstall.php                      # removes plugin options on uninstall
└── readme.txt                         # standard WordPress.org plugin readme
```

## Settings screen (`Settings → DIYSEO Sync`)

Capability: `manage_options`. All actions nonce-protected.

- DIYSEO Base URL
- Site ID
- API Key (password field)
- "Test connection" button — `GET .../articles?limit=1`, shows success/failure inline before save
- Sync interval: 15 min / 30 min / hourly / every 6 hours / daily (sub-hour options registered via
  the `cron_schedules` filter)
- "Automatic sync enabled" checkbox — when off, the cron event is not scheduled; manual sync still
  works
- WordPress author — dropdown of users with `edit_posts`, assigned to every synced post
- "Sync now" button (AJAX + nonce) — runs the sync engine synchronously and reports a summary
  (created / updated / unpublished / errors)
- Status block: last run timestamp, last run summary, rolling log of the last ~20 messages (stored
  in a single option)

## Sync engine

### Identity & change detection

- Each synced post stores postmeta `_diyseo_article_id` (dedupe key) and `_diyseo_updated_at`
  (DIYSEO's `updatedAt` as of the last sync).
- Lookup existing post via `get_posts`/`WP_Query` filtered on `_diyseo_article_id`.

### Field mapping

| DIYSEO field | WordPress field |
|---|---|
| `title` | `post_title` |
| `contentHtml` | `post_content` |
| `excerpt` | `post_excerpt` |
| `slug` | `post_name` (WP resolves collisions) |
| `status === "PUBLISHED"` | `post_status = publish` |
| author (from settings) | `post_author` |
| `coverImageUrl` | downloaded via `media_sideload_image`/`media_handle_sideload` and set as the Featured Image; source URL cached in `_diyseo_cover_image_source` postmeta to skip re-download when unchanged |
| `seoTitle` / `seoDescription` | Yoast active → `_yoast_wpseo_title` / `_yoast_wpseo_metadesc`; RankMath active → `rank_math_title` / `rank_math_description`; neither active → skipped |

Fixed for v1 (not configurable): `post_type = post`, no category/tag mapping (DIYSEO articles have
no equivalent taxonomy today).

### Run algorithm (cron event or "Sync now")

1. Load settings; if base URL, site ID, or API key are missing, log an error and stop.
2. Page through `GET /articles?status=PUBLISHED&include=content&limit=50&cursor=...` until
   `nextCursor` is null, collecting the full set of article ids seen this run.
3. Per article:
   - No existing post for that `_diyseo_article_id` → create.
   - Existing post, but `updatedAt` differs from the stored `_diyseo_updated_at` → update.
   - Existing post, `updatedAt` unchanged → skip (avoids redundant work, including image
     re-download).
4. **Unpublish pass**: after processing, find posts with `_diyseo_article_id` set whose id was
   *not* in this run's seen set and whose `post_status` is `publish` → set to `draft`. Posts are
   never deleted by the plugin.
5. Persist a run summary (created/updated/unpublished/error counts) and timestamp to an option for
   display in the settings screen.

### Known limitation (accepted for v1)

The Publishing API has no "updated since" filter, so every run re-lists the full `PUBLISHED` set
(paginated) and diffs by `updatedAt` on the WordPress side rather than filtering server-side. This
is acceptable given DIYSEO's current auto-publish caps (max 1 auto article/day/site, 5/run), but is
worth revisiting if a site's published catalog grows very large.

## Security & robustness

- All outbound calls via `wp_remote_get`/`wp_remote_post` with a timeout; failures are logged, never
  fatal to the cron run.
- Standard WP sanitization on every settings input (`sanitize_text_field`, `esc_url_raw`, `absint`).
- Nonce + `manage_options` capability check on every admin action (save settings, test connection,
  manual sync).
- The API key is stored in `wp_options` as plain text, consistent with common WordPress plugin
  convention; called out explicitly in the plugin readme as a known limitation.

## Testing plan

Manual verification against a local WordPress instance (or `wp-env`) pointed at a local DIYSEO dev
server with at least one seeded/published article:

- New article in DIYSEO → creates a new WP post on sync.
- Edited article (`updatedAt` changes) → updates the existing WP post, does not duplicate.
- Unchanged article → skipped, no redundant image re-download.
- `coverImageUrl` present → featured image set correctly in the Media Library.
- Yoast (or RankMath) active → `seoTitle`/`seoDescription` land in the plugin's native meta fields.
- Article un-published in DIYSEO → corresponding WP post flips to `draft`, is not deleted.
- "Sync now" button and the scheduled WP-Cron event both trigger the same engine and report a
  correct summary.
- Missing/invalid settings (bad API key, wrong site id) → clear error surfaced in the admin UI, no
  fatal errors.
