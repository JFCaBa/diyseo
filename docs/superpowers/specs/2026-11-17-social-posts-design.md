# Social posts from articles — design

Date: 2026-11-17. Status: the user skipped the brainstorming questions ("salta las preguntas y empieza directamente"). Every decision below is Claude's call unless it is quoted from the user.

## Intent

The user said: "Hemos publicado algunos posts en facebook para mycarplate … usando chrome, lo ideal sería que la plataforma, el hub, incluyera opción de crear posts basados en los artículos, tanto para facebook como para instagram, X, etc."

Today posts are written and published by hand through the browser. The hub already holds the material for them: the article, its cover image, the brand profile, and the public article URL. The feature turns a published article into ready-to-post copy for each network, and publishes it directly where the hub can do that safely and for free.

The Mycarplate Facebook page (checked 2026-11-17) uses image posts: a picture, short copy with ✅ bullet lines, and a link to mycarplate.online. The page has an Instagram account linked.

## Goals

1. On an article's page, "Generate social posts" makes one draft per network: **Facebook, Instagram, X and LinkedIn**. Drafts are written in the site's content language, in the brand voice, and state only facts from the article.
2. Drafts can be edited (with a live character counter against each network's limit) and saved.
3. **Facebook** and **Instagram** drafts publish directly from the hub to the site's connected Facebook Page and its linked Instagram professional account, using the article's cover image.
4. **X** and **LinkedIn** drafts get an "Open in X" / "Open in LinkedIn" button that opens the network's own compose screen with the text and link pre-filled (web intent URLs), plus "Copy". There is no API cost and no app review.
5. Each site has one Meta connection, set in the site's settings by a workspace OWNER. The token is stored encrypted.

## Non-goals (v1)

- Scheduling, and auto-posting when an article is published.
- Facebook Login / OAuth "Connect with Facebook" button. v1 takes a pasted token, the same pattern castelo-marketing uses for ads. OAuth needs Meta App Review before customers outside the app's roles can use it.
- X and LinkedIn API posting (the X API write tier is paid; LinkedIn needs partner approval).
- Threads, TikTok, Pinterest, Google Business Profile.
- Carousels, video, and per-network generated images.
- Engagement analytics.
- Posts for article translations (the posts use the original article only).

## Anti-goals (a failure even if it works)

- Posting anything without an explicit click on a confirmation that names the network and the Page or account.
- Posting the same article twice to the same network by accident (a double click, a retry after a timeout).
- Leaking the Meta token: to the browser, to logs, or in error messages.
- Copy that invents product facts (prices, coverage, guarantees) not in the article.
- Publishing a link to an article that is not live (status DRAFT).

## Decisions

### Data (Prisma)

- `SiteSocialConnection` (1:1 with `SiteProject`, cascade delete) has these fields:
  - `provider` (`"META"`), `pageId`, `pageName`
  - `instagramAccountId?`, `instagramUsername?`
  - `accessTokenEncrypted`, `tokenLast4`
  - `connectedByUserId`, `connectedAt`, `updatedAt`
- `SocialPost` has these fields:
  - `id`, `articleId` (cascade), `siteProjectId` (cascade)
  - `network` enum `SocialNetwork { FACEBOOK INSTAGRAM X LINKEDIN }`
  - `text`, `status` enum `SocialPostStatus { DRAFT PUBLISHING PUBLISHED FAILED }`
  - `externalId?`, `externalUrl?`, `error?`, `publishedAt?`, timestamps
  - `@@unique([articleId, network])`: one post per article per network. A PUBLISHED post is read-only and is never regenerated or published again in v1. That is the guard against double posting.

### Token encryption

AES-256-GCM. The key comes from env `SOCIAL_TOKEN_KEY` (32 bytes, base64). Without the key, connecting and publishing fail closed with a clear error, and generating drafts still works. Only `tokenLast4` ever reaches a page.

### Connection (site settings, OWNER only)

The OWNER pastes the token and the Page ID. On save, the hub verifies with `GET /{pageId}?fields=name,instagram_business_account{id,username}`. A failure saves nothing and shows Meta's error message, with the token redacted. On success it stores the Page name and IG account. "Disconnect" deletes the row.

The setup note tells the owner which permissions the token needs: `pages_manage_posts`, `pages_read_engagement`, `instagram_basic`, `instagram_content_publish`. A Business Manager system-user token with the Page and IG account assigned is recommended because it does not expire. Graph API version: env `META_GRAPH_VERSION`, default `v26.0` (the same default castelo uses).

### Generation

A new `AIGenerationService` method, `generateSocialPosts(ctx)`, implemented for Gemini and DeepSeek. It returns a Zod-validated `{ facebook, instagram, x, linkedin }`.

Context: article title, excerpt and markdown (truncated to about 12k characters), site name and domain, brand profile, and the public article URL.

Prompt rules:
- State only facts found in the article.
- Follow the brand voice and the `topicsToAvoid` list.
- No fake urgency and no absolute claims.
- Per network:

| Network | Limit | Hashtags | Link |
|---|---|---|---|
| Facebook | ≤ 1,500 chars, hook first, short lines, a ✅ bullet list allowed | — | ends with the link |
| Instagram | ≤ 2,000 chars | 3–8 at the end | none, says the link is in the bio |
| X | ≤ 250 chars | — | none; the app appends the link, which X counts as 23 |
| LinkedIn | ≤ 1,800 chars, professional tone | — | ends with the link |

The schema enforces these limits. One retry on validation failure, with the error fed back, following the existing generator pattern.

Generation creates or overwrites the DRAFT and FAILED rows of that article. PUBLISHED rows are kept untouched. It does not consume article credits. It is rate-limited to 10 generations per workspace per hour with the existing `createFixedWindowLimiter`.

### Publishing (Facebook, Instagram)

Preconditions, all checked server-side:
- The article is PUBLISHED.
- The site has a connection.
- The post is DRAFT or FAILED, with text within its limit.
- For Instagram: the site has an IG account and the article has a cover image.

The post is claimed atomically (`updateMany where status in [DRAFT, FAILED] → PUBLISHING`). If 0 rows change, someone else is already publishing it, and nothing is sent.

- **Facebook:** with a cover image, `POST /{pageId}/photos` with `url=<social image URL>` and `caption=text`. Without one, `POST /{pageId}/feed` with `message=text` and `link=articleUrl`.
- **Instagram:**
  1. `POST /{igId}/media` with `image_url` and `caption`.
  2. Poll `GET /{containerId}?fields=status_code` until `FINISHED`, every 2 s for up to 30 s (`ERROR` or a timeout → FAILED).
  3. `POST /{igId}/media_publish` with `creation_id`.
  4. Read the `permalink`.

On success the post becomes PUBLISHED, with `externalId`, `externalUrl` and `publishedAt`. On failure it becomes FAILED with Meta's message, redacted. A FAILED post can be retried.

**Social image URL:** public route `GET /api/public/sites/[siteId]/articles/[slug]/social-image`.
- Serves only PUBLISHED articles that have a cover.
- Reads the cover through the same fetch path as the existing `/api/public/image` proxy (keeping its host guard).
- Converts it with `sharp` to JPEG (Instagram accepts JPEG only), at most 1440 px wide, with the aspect ratio clamped to Instagram's 4:5–1.91:1 range by cropping the centre.
- Returns `image/jpeg` with long cache headers.
- The absolute URL uses `getAppOrigin()`, because Meta must be able to fetch it.

**Article URL:** if the site's proxy is verified (`proxyVerifiedAt`) and the domain resolves (`siteOriginFromDomain`), it is `https://<domain>/blog/<slug>`. Otherwise it is `buildPublicArticleUrl(siteId, slug)`.

### X / LinkedIn

- X: `https://x.com/intent/post?text=<text>&url=<articleUrl>`
- LinkedIn: `https://www.linkedin.com/feed/?shareActive=true&text=<text + "\n\n" + articleUrl>`
- Both open in a new tab. "Mark as posted" sets the status to PUBLISHED without an external ID, so the UI shows it as done.

### UI

**Article page:** a "Social posts" section under the editor.
- No posts yet: a "Generate social posts" button.
- After generating, four cards (Facebook, Instagram, X, LinkedIn). Each has:
  - an editable textarea, a counter turning red over the limit, and Save;
  - its network action;
  - a status badge, a link to the live post, and the error text when FAILED.
- Publishing opens a confirmation that reads "Publish to Facebook Page «Mycarplate»?" (or "…to Instagram @<username>?").
- A "Regenerate" button redoes the unpublished drafts.
- When the article is a draft, the publish buttons are disabled with "Publish the article first".
- When the site has no connection, they are disabled with a link to settings.

**Site settings:** a "Social accounts" card. Owners can connect or disconnect; members see the connection read-only.

### Access

Every action and route scopes by `workspaceId` (session) and `siteId`, per CLAUDE.md. Generating, editing and publishing are open to any workspace member with access to the site, as article publishing is. Connect and disconnect are OWNER only. All mutations are server actions in `lib/actions.ts` (or a new `lib/social-actions.ts`, following `team-actions.ts`), validated by Zod schemas in `lib/validations.ts`.

## Left to the builder

- The exact component split and styling, following existing components.
- The Gemini/DeepSeek call details, following `generateArticle`.
- Test structure (`node:test` via `tsx`). The Graph client takes an injectable `fetch`, so tests never hit Meta.

## Changes after consenso (2026-11-17, codex + agy) — these override the text above

- **Page token:** on connect, the hub reads `access_token` from `GET /{pageId}?fields=name,access_token,instagram_business_account{id,username}` and stores the Page token. A system-user token cannot post to a Page directly.
- **Facebook photo posts:** `/photos` ignores `link`, so the link is appended to the caption when it is missing.
- **Covers:** v1 uses only covers stored in DIYSEO (`/uploads/`). It fetches no remote URLs (no SSRF surface). With a remote or missing cover, Facebook makes a link post and Instagram is blocked. The image route is keyed by `articleId`, not slug.
- **Uncertain results:**
  - A 4xx from Meta is a definite failure (FAILED, retryable).
  - A 5xx, a timeout or a network error on the publishing call leaves the post PUBLISHING.
  - After 5 minutes it shows as "Unknown result: check the Page", and the user picks "It's on the Page" or "It's not there, retry". It never retries by itself.
  - Writes are tied to an `attemptId`.
- **Concurrency:** every post write is conditional on its status. Publish claims first, then re-reads and validates.
- **Instagram polling:** at most 10 × 2 s. If processing does not finish, it is a safe FAILED, because `media_publish` was never called.
- **Hashtags:** 3–8 applies only to AI output. Manual edits are capped at Instagram's real maximum of 30.
- **Regenerate:** confirmation, plus per-network regenerate.
- **Settings:** "Test connection". No `expiresAt` in v1.
