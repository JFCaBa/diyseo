# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev                      # Next.js dev server on :3000
npm run build                    # production build
npm run start                    # run the built app
npm run lint                     # next lint

npm run prisma:generate          # regenerate Prisma client (also runs postinstall)
npm run prisma:migrate           # create + apply a new dev migration
npm run prisma:migrate:deploy    # apply committed migrations (prod + CI)
npm run prisma:seed              # run prisma/seed.ts (demo workspace/site/articles)
```

There is no test runner configured.

`prisma.config.ts` manually loads `.env.local` then `.env` before invoking Prisma, so Prisma CLI commands pick up `DATABASE_URL` without a separate dotenv step. `postinstall` runs `prisma generate`, so after `npm install` the client is always in sync with `prisma/schema.prisma`.

## Architecture

Next.js 15 App Router + React 19 + Prisma (PostgreSQL) + Tailwind + Zod. TypeScript path alias `@/*` maps to the repo root.

### Two parallel surfaces on one app

The app serves two distinct audiences from the same Next process, split by route prefix:

- **Admin workspace** — auth-gated. Routes at `/`, `/settings`, `/new-site`, and the multi-tenant tree under `app/[siteId]/...` (dashboard, `brand-dna`, `articles`, `articles/[articleId]`, `articles/new`, `keywords`, `calendar`, `analytics`). `[siteId]` is the active site within the user's workspace; admin pages must always scope Prisma queries by both `workspaceId` (from session) and `siteId` (from the route param).
- **Public blog + widget feed** — unauthenticated. Routes under `app/blog/...` (`/blog`, `/blog/[siteId]`, `/blog/[siteId]/[slug]`, plus `rss.xml`, `atom.xml`, `sitemap.xml`, and `/blog/robots.txt`), and JSON endpoints under `app/api/public/sites/[siteId]/{articles,config}`. These must only ever return `PUBLISHED` articles and must not leak workspace-internal fields.

`public/embed.js` is the third-party widget script served at `/embed.js`. It reads `data-site` / `data-base-path` / `data-theme` / `data-title` from the `<script>` tag and fetches from `/api/public/sites/:siteId/{articles,config}`. The public API response shape (see README) and the embed script's attribute contract are load-bearing — downstream sites depend on them, so don't change field names or status semantics without intent.

### Auth and middleware

NextAuth v5 (beta) with Google provider, database session strategy, Prisma adapter.

- `auth.config.ts` is the edge-safe config (providers + `authorized` callback). Used by both `middleware.ts` and `lib/auth.ts`.
- `lib/auth.ts` is the full server config with the Prisma adapter, session callback, and an `ensureUserWorkspace` hook that runs on `signIn` to provision a `Workspace` + default `SiteProject` + `BrandProfile` for new users.
- `middleware.ts` applies `auth.config.ts`'s `authorized` callback to every non-asset route. The `authorized` callback whitelists `/`, `/blog/*`, `/api/auth/*`, `/api/public/*`; everything else requires a session.
- `types/next-auth.d.ts` extends the session to include `user.id` and `user.workspaceId`.
- `session.user.workspaceId` is the canonical scope for admin reads/writes — use it rather than re-deriving ownership from `user.id`.

### Data model (prisma/schema.prisma)

`User ──1:1── Workspace ──1:N── SiteProject ──1:1── BrandProfile` and `SiteProject ──1:N── {Article, Keyword}`. `Article.keywordId` is a nullable FK with `SetNull`. `Article` has a composite unique `(siteProjectId, slug)` and an index on `(siteProjectId, status, publishedAt)` — public listings rely on this index. `ArticleStatus` is `DRAFT | PUBLISHED`; `KeywordStatus` is `NEW | USED`.

### Server actions + validation

`lib/actions.ts` (`"use server"`) is the entry point for every admin mutation (create/update site, brand DNA, article CRUD, status toggle, scheduling, keyword assignment). Actions read `FormData`, parse through a Zod schema from `lib/validations.ts`, mutate via `lib/prisma.ts`, then call `revalidatePath` and/or `redirect`. When adding a mutation, follow this pattern — add the Zod schema in `lib/validations.ts`, add the server action in `lib/actions.ts`, and pass the action to a client form component rather than building a `/api/internal` route.

### AI layer

`lib/ai/index.ts` picks a provider by `AI_PROVIDER` env (`gemini` | `deepseek`) and returns an `AIGenerationService` (`lib/ai/types.ts`) with two methods: `generateArticle(ArticleGenerationContext)` and `generateBrandDNA(BrandDNAGenerationContext)`. Both return Zod-validated shapes (`GeneratedArticleInput`, `GeneratedBrandDNAInput`) from `lib/validations.ts`. Prompts live in `lib/ai/prompts.ts`. New providers: add a class implementing `AIGenerationService`, register it in the switch in `index.ts`.

`lib/generate-article.ts` and `lib/generate-brand-dna.ts` are the higher-level orchestration called from server actions — they load the `BrandProfile`, call the AI service, validate, and persist.

### Known edges to watch

- `NEXT_PUBLIC_APP_URL` is used to build absolute URLs in feeds/sitemap/robots and in the embed snippet — setting this wrong in prod breaks canonical links and feed discovery.
- The app relies on `ensureUserWorkspace` at sign-in time to guarantee every authenticated user has exactly one workspace and at least one site. Admin pages assume this invariant and can 404 or crash if it's bypassed.
- The Docker image does not run migrations or provision Postgres — `npm run prisma:migrate:deploy` must be run against the target DB before serving traffic.
