# Social posts from articles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn a published article into Facebook, Instagram, X and LinkedIn drafts. Facebook and Instagram publish directly to the site's Meta Page and account; X and LinkedIn open their compose screens pre-filled.

**Architecture:** Two new Prisma models: `SiteSocialConnection` (the encrypted Meta token) and `SocialPost` (one row per article and network). `lib/social/*` holds pure, tested helpers: limits, crypto, URLs, image crop, and a Graph client with an injectable `fetch`. Server actions live in `lib/social-actions.ts`. A public route serves a JPEG version of the cover for Meta. The UI is a panel on the article page plus a card in site settings.

**Tech Stack:** Next 15 App Router, React 19, Prisma/Postgres, Zod 3, sharp 0.34, `node:test` via `tsx` (`npm test`).

**Spec:** `docs/superpowers/specs/2026-11-17-social-posts-design.md`

## Global Constraints

- Every action and route in the signed-in area scopes by `workspaceId` (session) and `siteId`. Article pages keep `await requireSitePage(siteId)` (`tests/no-owner-scoping.test.ts` enforces it).
- The token never reaches the client, logs or error strings. The UI only ever sees `tokenLast4`. Every Meta error string goes through `redact()` before it is stored or returned.
- `SOCIAL_TOKEN_KEY`: 32 bytes, base64. Missing or invalid → connect and publish throw `SocialConfigError("SOCIAL_TOKEN_KEY is not set")`; generating drafts still works.
- `META_GRAPH_VERSION`: default `v26.0`.
- Limits (characters), exactly: FACEBOOK 1500, INSTAGRAM 2000, X 250, LINKEDIN 1800. Instagram: 3–8 hashtags.
- A PUBLISHED post is never regenerated, edited or published again.
- Every write to a `SocialPost` row is conditional: save, regenerate and claim use `updateMany` with `status in [DRAFT, FAILED]` (and `siteProjectId`), and result writes use `attemptId`. A plain `update` by id never happens.
- Covers: in v1 the social image comes only from local covers (`coverImageUrl` starting with `/uploads/`, which is where DIYSEO stores the covers it generates). Nothing is fetched from a remote URL. With a remote or missing cover, Facebook posts a link post (`/feed`) and Instagram is blocked with `"Instagram needs a cover image stored in DIYSEO"`.
- Result of a Meta call: a 4xx response with an `error` body is a definite rejection → FAILED (can be retried). A 5xx, a network error or a timeout **on the publishing call** (`/photos`, `/feed`, `/media_publish`) is uncertain → the post stays PUBLISHING. An error before the publishing call (container creation, polling) is definite → FAILED.
- Consenso on the plan: `.consenso/2026-11-17-083704` (codex + agy; opencode did not take part).
- Publishing requires: article `status === "PUBLISHED"`; the post's status is DRAFT or FAILED; the text is non-empty and within its limit; a connection exists; and, for Instagram, `instagramAccountId` is set and the article has a `coverImageUrl`.
- Generation: rate-limited to 10 per workspace per hour (`createFixedWindowLimiter`). No article credit is consumed.
- Migration name: `prisma/migrations/20261117090000_add_social_posts`.

## Review Focus

1. **Double click / two tabs on Publish:** only one Graph call is made. The claim `updateMany(status in [DRAFT, FAILED] → PUBLISHING)` must return count 1 to proceed. Test in Task 5 (`tests/social-claim.db.test.ts`, same setup and skip rule as `tests/quota.db.test.ts`).
2. **A post stuck in PUBLISHING after a crash, timeout or 5xx:** a PUBLISHING row older than 5 minutes shows as `UNKNOWN` ("Unknown result: check the Page"). It never turns into FAILED on its own. The user resolves it with "It's on the Page" (→ PUBLISHED) or "It's not there, retry" (confirmed; → claim again). Test in Task 5 (`effectiveStatus`, `resolveUnknownAction`).
3. **A Meta error message echoing the token** (Graph sometimes includes the request URL with `access_token=`): `redact` removes the token value and any `access_token=…` query. Test in Task 3.
4. **A remote, missing, path-traversing or corrupt cover:** the social-image route reads only local `/uploads/` files inside `LOCAL_UPLOAD_DIR`, follows no URLs, caps input at 15 MB and 40 M pixels, and returns 404 instead of a broken JPEG. Test in Task 4.
5. **Article unpublished after the drafts were made:** publish re-reads the article status server-side and refuses. Test in Task 5 (`publishBlocker`).

---

### Task 1: Data model and token crypto

**Files:**
- Modify: `prisma/schema.prisma` (add the models and enums; back-relations on `SiteProject` and `Article`)
- Create: `prisma/migrations/20261117090000_add_social_posts/migration.sql` (via `npm run prisma:migrate -- --name add_social_posts --create-only`, then renamed to the fixed timestamp)
- Create: `lib/social/crypto.ts`, `tests/social-crypto.test.ts`
- Modify: `.env.example` (`SOCIAL_TOKEN_KEY=`, `META_GRAPH_VERSION=v26.0`, each with a one-line comment)

**Interfaces:**
- Produces:
  - Prisma models as listed in the spec's Data section, with these changes:
    - `SiteSocialConnection.siteProjectId @unique`. It stores the **Page** access token (see Task 3), never the pasted user or system-user token.
    - `SocialPost` gets `@@unique([articleId, network])`, `@@index([siteProjectId])` and a nullable `attemptId String?`.
    - Every relation is `onDelete: Cascade` (to `SiteProject` and `Article`).
  - Enums `SocialNetwork { FACEBOOK INSTAGRAM X LINKEDIN }` and `SocialPostStatus { DRAFT PUBLISHING PUBLISHED FAILED }`.
  - `class SocialConfigError extends Error`.
  - `encryptToken(plain: string, env?: NodeJS.ProcessEnv): string` returns `v1:<iv b64>:<tag b64>:<ciphertext b64>` (AES-256-GCM, 12-byte random IV).
  - `decryptToken(blob: string, env?): string`.
  - `tokenLast4(plain: string): string`.

- [ ] **Step 1: Write failing tests** in `tests/social-crypto.test.ts`:
  - `"round-trips a token"`: decrypt(encrypt(x)) === x, with the key from `randomBytes(32).toString("base64")`.
  - `"two encryptions of the same token differ"`.
  - `"a tampered blob throws"`: flip one character of the ciphertext part.
  - `"missing or short key throws SocialConfigError"`: `{}` and a 16-byte key.
  - `"tokenLast4 returns the last 4 characters"`.
- [ ] **Step 2: Run** `npx tsx --test tests/social-crypto.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `lib/social/crypto.ts`. Edit the schema and create the migration. Run `npm run prisma:generate`.
- [ ] **Step 4: Run** `npx tsx --test tests/social-crypto.test.ts` and `npx tsc --noEmit`. Expected: PASS, no type errors.
- [ ] **Step 5: Commit** (`consenso` first): `feat(social): data model and encrypted Meta token storage`

---

### Task 2: Limits, AI generation and draft merge

**Files:**
- Create: `lib/social/limits.ts`, `lib/social/drafts.ts`, `tests/social-generation.test.ts`
- Modify: `lib/validations.ts` (`GeneratedSocialPostsSchema`), `lib/ai/types.ts` (`SocialPostsGenerationContext`, the new method on `AIGenerationService`), `lib/ai/prompts.ts` (two builders), `lib/ai/gemini-generator.ts`, `lib/ai/deepseek-generator.ts`

**Interfaces:**
- Produces:
  - `SOCIAL_LIMITS: Record<SocialNetwork, number>` with the values from Global Constraints.
  - `GeneratedSocialPostsSchema = z.object({ facebook, instagram, x, linkedin })`: each is a trimmed string, min 1, max its limit. `instagram` also needs 3–8 `#\w+` hashtags (refine message: `"instagram needs 3 to 8 hashtags"`).
  - `type SocialPostsGenerationContext = { article: { title: string; excerpt: string | null; markdown: string }; articleUrl: string; site: { name: string; domain: string }; brandProfile: ArticleGenerationContext["brandProfile"] }`. `markdown` is truncated to 12,000 characters by the caller.
  - `AIGenerationService.generateSocialPosts(ctx: SocialPostsGenerationContext): Promise<GeneratedSocialPosts>`.
  - `buildSocialPostsSystemPrompt(ctx)` and `buildSocialPostsUserPrompt(ctx)`.
  - `mergeDrafts(existing: { network: SocialNetwork; status: SocialPostStatus }[], generated: GeneratedSocialPosts): { network: SocialNetwork; text: string }[]` returns the networks to upsert as DRAFT: every network whose existing status is not PUBLISHED or PUBLISHING.

- [ ] **Step 1: Write failing tests** in `tests/social-generation.test.ts`:
  - `"schema enforces each network limit"`: X at 251 characters fails; X at 250 passes; Facebook at 1501 fails.
  - `"instagram needs 3 to 8 hashtags"`: 2 fails, 3 passes, 9 fails.
  - `"system prompt states facts-only, brand voice, topics to avoid and every limit"`: matches `/only facts/i`, the `topicsToAvoid` value from the context, `1500`, `2000`, `250`, `1800`, `/link in (the )?bio/i`, and `/no fake urgency/i`.
  - `"user prompt carries title, excerpt, article URL and the content language"`.
  - `"mergeDrafts skips PUBLISHED and PUBLISHING, keeps DRAFT and FAILED"`.
- [ ] **Step 2: Run** `npx tsx --test tests/social-generation.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** The generator methods follow `generateBrandDNA`: `requestJson` then `.parse`. On a `ZodError`, make one retry that appends `Your JSON was invalid: <issues>. Return the corrected JSON only.` to the user text; a second failure throws.
- [ ] **Step 4: Run** the file and `npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 5: Commit** (`consenso` first): `feat(social): AI drafts for Facebook, Instagram, X and LinkedIn`

---

### Task 3: Meta Graph client

**Files:**
- Create: `lib/social/meta-graph.ts`, `tests/social-meta-graph.test.ts`

**Interfaces:**
- Produces:
  - `type GraphDeps = { fetch: typeof fetch; sleep: (ms: number) => Promise<void>; version: string }`.
  - `defaultGraphDeps(): GraphDeps` (global fetch, `setTimeout` sleep, `process.env.META_GRAPH_VERSION ?? "v26.0"`).
  - `class MetaGraphError extends Error`. Its message is already redacted.
  - `redact(text: string, token: string): string` replaces the token and any `access_token=[^&\s"]+` with `access_token=***`.
  - `verifyPage(token, pageId, deps): Promise<{ pageName: string; pageToken: string; instagramAccountId: string | null; instagramUsername: string | null }>`. It calls `GET /{pageId}?fields=name,access_token,instagram_business_account{id,username}`. `pageToken` is `access_token` from the response, or the pasted token when Meta returns none (the pasted token was already a Page token). Publishing to a Page needs a Page token: a system-user token fails with `(#200)`.
  - `class MetaGraphError extends Error { definite: boolean; status: number }`. `definite` is true only for a 4xx with an `error` body. `postGraph(..., { publishing: true })` marks 5xx, network and timeout errors as `definite: false`; any error on a non-publishing call is `definite: true`.
  - `publishFacebook(token, pageId, { text, imageUrl, link }, deps): Promise<{ id: string; url: string }>`. With an image: `POST /{pageId}/photos` with `url` and `caption`. `/photos` ignores `link`, so the caption is `text` with `\n\n<link>` appended when `text` does not already contain `link`. The URL is `https://www.facebook.com/{post_id ?? id}`. Without an image: `POST /{pageId}/feed` with `message` and `link`.
  - `publishInstagram(token, igId, { text, imageUrl }, deps): Promise<{ id: string; url: string | null }>`:
    1. Create the container.
    2. Poll `status_code` every 2000 ms, at most 10 polls (FINISHED → publish; ERROR or exhausted → definite `MetaGraphError` "Instagram is still processing the image, try again", which is safe because `media_publish` was not called).
    3. Call `media_publish`.
    4. Read `GET /{mediaId}?fields=permalink`. A failed permalink read returns `url: null`; it never fails the publish.
  - Every request sends the token in the POST body or as an `access_token` query param, never in an error. Each request has a 30 s abort timeout.

- [ ] **Step 1: Write failing tests** with a fake `fetch` that records calls and returns queued JSON responses:
  - `"verifyPage reads name and the linked instagram account"`.
  - `"verifyPage without instagram returns nulls"`.
  - `"a Graph error becomes MetaGraphError with Meta's message, token redacted"`: the fake returns `{ error: { message: "Invalid token abc123TOKEN https://graph.facebook.com/x?access_token=abc123TOKEN" } }`, and the message contains neither `abc123TOKEN`.
  - `"publishFacebook with image posts to /photos with url and caption"`.
  - `"publishFacebook without image posts to /feed with message and link"`.
  - `"publishInstagram polls until FINISHED, then publishes and returns the permalink"`: IN_PROGRESS, IN_PROGRESS, FINISHED; `sleep` is called twice with 2000.
  - `"publishInstagram fails on ERROR status and after 10 polls, without calling media_publish"`.
  - `"verifyPage returns the Page token from access_token, or the pasted token when absent"`.
  - `"publishFacebook appends the link to a /photos caption that lacks it, not twice"`.
  - `"a 500 or network error on /photos or media_publish is MetaGraphError with definite=false; a 400 with error body is definite=true"`.
  - `"a failed permalink read still returns the media id with url null"`.
  - `"requests use the configured Graph version"`: the URL starts with `https://graph.facebook.com/v26.0/`.
- [ ] **Step 2: Run** `npx tsx --test tests/social-meta-graph.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `lib/social/meta-graph.ts`.
- [ ] **Step 4: Run** the file. Expected: PASS.
- [ ] **Step 5: Commit** (`consenso` first): `feat(social): Meta Graph client for Page and Instagram publishing`

---

### Task 4: Social image route and share URLs

**Files:**
- Create: `lib/social/social-image.ts`, `lib/social/urls.ts`, `app/api/public/sites/[siteId]/articles/[articleId]/social-image/route.ts`, `tests/social-image.test.ts`
- The existing `/api/public/image` proxy is not touched.

**Interfaces:**
- Produces:
  - `cropBox(width: number, height: number): { left: number; top: number; width: number; height: number }`, a centre crop clamping the ratio to [0.8, 1.91].
  - `toSocialJpeg(input: Buffer): Promise<Buffer>`: `sharp(input, { limitInputPixels: 40_000_000 })`, crop, resize to at most 1440 px wide, JPEG quality 85.
  - `isLocalCover(coverImageUrl: string | null): boolean`: true only for the `/uploads/` prefix (from `PUBLIC_UPLOAD_BASE_URL`, default `/uploads`).
  - `loadLocalCover(coverImageUrl: string): Promise<Buffer | null>`: reads from `LOCAL_UPLOAD_DIR` with the same path-traversal guard as `app/uploads/[...path]/route.ts`. Files over 15 MB, missing files and anything not local → null. It never fetches a URL.
  - `articleShareUrl(site: { id: string; domain: string; proxyVerifiedAt: Date | null }, slug: string): string`: `${siteOriginFromDomain(domain)}/blog/${slug}` when proxy-verified and the origin is non-null, otherwise `buildPublicArticleUrl(site.id, slug)`.
  - `socialImageUrl(siteId: string, articleId: string, coverVersion: string): string` = `${getAppOrigin()}/api/public/sites/${siteId}/articles/${articleId}/social-image?v=${coverVersion}`, where `coverVersion` is the last path segment of `coverImageUrl` (a cache-buster when the cover changes).
  - `xIntentUrl(text, url)` and `linkedinIntentUrl(text, url)`, exactly as in the spec.
  - Route `GET`: finds the article by `id` and `siteProjectId` with `status: "PUBLISHED"` and a local cover; anything else (including a failed load or a sharp error) is 404. Returns `image/jpeg` with `Cache-Control: public, max-age=86400`. Middleware already lets `/api/public` through.

- [ ] **Step 1: Write failing tests:**
  - `"cropBox keeps ratios inside 0.8–1.91 untouched"`: 1600×900 is unchanged.
  - `"cropBox trims a too-wide image to 1.91"`: 4000×1000 → width 1910, centred.
  - `"cropBox trims a too-tall image to 0.8"`: 1000×2000 → height 1250.
  - `"toSocialJpeg returns a JPEG no wider than 1440"`: input is a 3000×1500 PNG made with sharp; check the output's first bytes are `ff d8` and its metadata width ≤ 1440.
  - `"articleShareUrl uses the client domain only when the proxy is verified"`.
  - `"xIntentUrl and linkedinIntentUrl encode text and link"`.
  - `"only local /uploads covers are used"`: `isLocalCover("https://x.com/a.png")` and `isLocalCover("//evil/a.png")` → false; `loadLocalCover("/uploads/../../etc/passwd")` → null.
  - `"toSocialJpeg rejects an image over the pixel limit"`: a 7000×7000 input throws, and the route maps that to 404.
- [ ] **Step 2: Run** `npx tsx --test tests/social-image.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the file, `npm test` and `npx tsc --noEmit`. Expected: all PASS.
- [ ] **Step 5: Commit** (`consenso` first): `feat(social): public JPEG cover for Meta and share URLs`

---

### Task 5: Server actions

**Files:**
- Create: `lib/social-actions.ts` (`"use server"`), `lib/social/rules.ts`, `lib/social/claim.ts`, `tests/social-rules.test.ts`, `tests/social-claim.db.test.ts`
- Modify: `lib/validations.ts` (`ConnectMetaSchema { siteId, pageId: trimmed /^\d{5,30}$/, accessToken: trimmed, min 20, max 1000 }`, `ResolveUnknownSchema { siteId, postId, outcome: enum published|retry }`, `GenerateSocialPostsSchema { siteId, articleId, network?: SocialNetwork }`, `SaveSocialPostSchema { siteId, postId, text: max 3000 }`, `SocialPostIdSchema { siteId, postId }`)

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces (`lib/social/rules.ts`, pure):
  - `effectiveStatus(p: { status: SocialPostStatus; updatedAt: Date }, now: Date): SocialPostStatus | "UNKNOWN"` returns `"UNKNOWN"` for PUBLISHING older than 5 min; otherwise the status unchanged. Nothing is written for UNKNOWN.
  - `textBlocker(network, text): string | null`: empty → `"Text is empty"`; over the limit → `"Text is over the <limit>-character limit"`; Instagram with more than 30 hashtags → `"Instagram allows at most 30 hashtags"`. Used by save, publish and mark-as-posted. The 3–8 hashtag rule applies only to AI output.
  - `publishBlocker(input: { network; text; status; articleStatus; hasConnection; hasInstagram; hasCover }): string | null`. Exact messages:
    - `"Publish the article first"`
    - `"Already published"`
    - `"Publishing in progress"`
    - `"Text is empty"`
    - `"Text is over the <limit>-character limit"`
    - `"Connect a Facebook Page in site settings"`
    - `"No Instagram account is linked to the Page"`
    - `"Instagram needs a cover image stored in DIYSEO"` (when the cover is missing or not local)
    - For X/LinkedIn, `"Open the network to post"` (they are never published through the API).
- Produces (actions; each returns `{ ok: true } | { ok: false; error: string }` and calls `revalidatePath`):
  - `connectMetaAction(formData)`: `requireOwner`, site in workspace, `verifyPage`, upsert with the encrypted token.
  - `disconnectMetaAction(formData)`: owner only.
  - `generateSocialPostsAction(formData {siteId, articleId, network?})`:
    - Checks a workspace member, the site and article in the workspace, and the rate limit (`"Too many generations, try again in an hour"`).
    - Makes the AI call.
    - For each network from `mergeDrafts` (only the given `network` when one is passed): `updateMany` with `status in [DRAFT, FAILED]` sets the text and status DRAFT. When count is 0 and no row exists, `create`; a P2002 there is ignored.
    - It never touches a PUBLISHING or PUBLISHED post.
  - `saveSocialPostAction`: checks `textBlocker`, then `updateMany({ where: { id, siteProjectId, status: { in: ["DRAFT","FAILED"] } }, data: { text, status: "DRAFT", error: null } })`. Count 0 → `"This post can no longer be edited"`.
  - `publishSocialPostAction(formData {siteId, postId})`:
    1. Check that the site is in the workspace.
    2. Claim first: `claimSocialPost(prisma, { postId, siteProjectId, attemptId: cuid })`. False → `"Publishing in progress"` (or `"Already published"` after a re-read).
    3. **After** the claim, re-read the post (its text is now frozen, because save refuses non-DRAFT/FAILED), the article and the connection.
    4. Check `publishBlocker`. If it blocks, return the post to its previous status with `updateMany where { id, attemptId }`, and return the message.
    5. Decrypt the token and call Graph.
    6. Write the result with `updateMany where { id, attemptId }`:
       - success → PUBLISHED with `externalId`, `externalUrl` and `publishedAt`;
       - `MetaGraphError.definite` → FAILED with the redacted message;
       - not definite → leave PUBLISHING and store the error as `"Unknown result: <redacted message>"`; the UI shows UNKNOWN once 5 minutes have passed.
  - `markSocialPostPostedAction`: X and LinkedIn only; checks `textBlocker`; conditional `updateMany` DRAFT or FAILED → PUBLISHED with `publishedAt`.
  - `resolveUnknownAction(formData {siteId, postId, outcome: "published" | "retry"})`: acts only on a PUBLISHING post older than 5 min (re-checked server-side). `published` → PUBLISHED (no `externalId`). `retry` → FAILED with error cleared, so the normal Publish (which asks for confirmation) can run again. Both are conditional on `status: PUBLISHING` and the stored `attemptId`.
  - `claimSocialPost(db, { postId, siteProjectId, attemptId }): Promise<boolean>` in `lib/social/claim.ts`: `updateMany({ where: { id: postId, siteProjectId, status: { in: ["DRAFT","FAILED"] } }, data: { status: "PUBLISHING", attemptId, error: null } })`, true when count is 1.

- [ ] **Step 1: Write failing tests** in `tests/social-rules.test.ts`:
  - `"effectiveStatus shows a PUBLISHING older than 5 minutes as UNKNOWN"`: at 4m59s it is PUBLISHING, at 5m01s it is UNKNOWN; DRAFT, FAILED and PUBLISHED are unchanged.
  - `"textBlocker: empty, over the limit, more than 30 Instagram hashtags; zero hashtags is fine"`.
  - `"publishBlocker"`: one assertion per message above, plus null for a valid Facebook draft and for a valid Instagram draft.
  - `tests/social-claim.db.test.ts`: `"only one of two concurrent claims wins"`. Seed a DRAFT post, then two concurrent `claimSocialPost` calls with different `attemptId`s → exactly one true. Also `"a PUBLISHED post cannot be claimed"` and `"a claim with the wrong siteProjectId fails"`.
  - `"social actions file scopes every query by workspace"`: a source check in the style of `no-owner-scoping.test.ts`. Every `prisma.socialPost.` and `prisma.siteSocialConnection.` call site in `lib/social-actions.ts` sits in a function that calls `requireWorkspace(` or `requireOwner(`.
- [ ] **Step 2: Run** `npx tsx --test tests/social-rules.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `rules.ts` and the actions.
- [ ] **Step 4: Run** `npm test` and `npx tsc --noEmit`. Expected: PASS.
- [ ] **Step 5: Commit** (`consenso` first): `feat(social): actions to connect Meta, generate, edit and publish posts`

---

### Task 6: UI

**Files:**
- Create: `components/social-posts-panel.tsx` (client), `components/site-social-connection-form.tsx` (client)
- Modify: `app/[siteId]/articles/[articleId]/page.tsx` (load the posts, connection summary and article status, then render the panel), `app/[siteId]/settings/page.tsx` (render the connection card; owners get the form, members a read-only line)

**Interfaces:**
- Consumes: the Task 5 actions; `SOCIAL_LIMITS`; `effectiveStatus`; `publishBlocker`; `xIntentUrl`/`linkedinIntentUrl`; `articleShareUrl`.
- Props passed from the server pages are plain data only: never the token or the encrypted blob, only `pageName`, `instagramUsername` and `tokenLast4`.

- [ ] **Step 1: Write the failing test** in `tests/social-rules.test.ts`: `"pages never pass the token to client components"`. A source check: neither page file nor either component contains `accessTokenEncrypted` or `decryptToken`, and the page selects the connection with an explicit `select` that omits `accessTokenEncrypted`.
- [ ] **Step 2: Run it.** Expected: FAIL (the components do not exist yet; the check reads the files).
- [ ] **Step 3: Build the UI** to the spec's UI section:
  - Cards in the order Facebook, Instagram, X, LinkedIn.
  - A counter shown as `n / limit`, red over the limit.
  - Publish opens a confirm dialog naming the Page or `@username`; use the existing in-page confirm pattern (see `article-delete-button.tsx`), not `window.confirm`.
  - Buttons disabled with the `publishBlocker` text as a hint.
  - X/LinkedIn get "Open in X" / "Open in LinkedIn" (new tab), "Copy" and "Mark as posted".
  - "Regenerate all" asks for confirmation ("Replaces the unpublished drafts, including your edits"). Each unpublished card also has its own "Regenerate" (`network` passed).
  - UNKNOWN cards show "Unknown result: check the Page" with "It's on the Page" and "It's not there, retry" (`resolveUnknownAction`, confirmed).
  - The settings card has "Test connection", which re-runs `verifyPage` and updates the Page name and IG account. It is owner-only and stores nothing new when it fails.
  - Published cards show a "View post" link.
  - Settings card: the setup note listing the four permissions and recommending a system-user token.
- [ ] **Step 4: Run** `npm test`, `npx tsc --noEmit` and `npm run build`. Expected: all pass and the build succeeds.
- [ ] **Step 5: Manual check** with `npm run dev` against the local DB:
  - Generate drafts for a published seed article.
  - Edit and save; the counter turns red over the limit.
  - X/LinkedIn open their compose screens with the text.
  - Without a connection, Publish is disabled with the hint.
  - Do **not** publish to a real Page without the user's go-ahead.
- [ ] **Step 6: Commit** (`consenso` first): `feat(social): social posts panel on the article page and Meta connection in settings`

---

### Task 7: Docs and handoff

- [ ] Add a short "Social posts" subsection to `CLAUDE.md` under Architecture. Cover: the models, `lib/social/*`, the encrypted token with `SOCIAL_TOKEN_KEY`, X/LinkedIn as intents only, and that the social-image route is public and serves PUBLISHED articles only.
- [ ] Commit `docs: social posts architecture note`.
- [ ] Deploy needs, for the user to approve:
  - `SOCIAL_TOKEN_KEY` added to the server `.env`, generated with `openssl rand -base64 32`.
  - `npm run prisma:migrate:deploy` run on the server.
  - A first real publish to the Mycarplate Page with a token the user creates.
