# DIYSEO

DIYSEO is a self-hosted SEO workspace for small teams and independent site owners who want to manage brand context, generate articles with AI, edit content manually, publish to a built-in public blog, and embed articles with a lightweight widget.

It ships as a Next.js + Prisma + PostgreSQL app with an admin workspace, public blog routes, feeds, sitemap support, and optional AI providers.

## Why DIYSEO

- Self-hosted: your database, your deployment, your content
- Structured editorial workflow: Brand DNA, keywords, drafts, scheduling, publishing
- Public delivery built in: blog index, article pages, RSS, Atom, sitemap, robots.txt
- Embeddable widget: render published content on external pages with a simple script tag
- Provider-agnostic AI layer: current support for Gemini and DeepSeek

## V1 Features

- Multi-site admin workspace
- Brand DNA editor and AI bootstrap
- AI article generation
- Manual article editor
- Keyword management and assignment
- Content calendar
- Basic analytics dashboard
- Public blog pages
- Public article/config API
- RSS, Atom, sitemap, and robots.txt support
- Embeddable article widget

## Quickstart

1. Copy envs:

```bash
cp .env.example .env
```

2. Update `.env` with your database and public URL.

3. Install dependencies:

```bash
npm install
```

4. Apply migrations:

```bash
npm run prisma:migrate:deploy
```

5. Seed demo content:

```bash
npm run prisma:seed
```

6. Start the app:

```bash
npm run dev
```

7. Open:

- Admin app: `http://localhost:3000`
- Public blog root: `http://localhost:3000/blog`

## Stack

- Next.js App Router
- React
- Prisma
- PostgreSQL
- Tailwind CSS
- Zod

## Requirements

- Node.js 20+
- npm 10+
- PostgreSQL 15+
- Orbstack recommended for local PostgreSQL on macOS

## Environment Variables

Copy [.env.example](/Volumes/HIKSEMI/Projects/diyseo/.env.example) to `.env`.

Required for most setups:

- `DATABASE_URL`
- `NEXT_PUBLIC_APP_URL`
- `AI_PROVIDER`
- `CRON_SECRET`

AI provider credentials:

- Gemini:
  - `GEMINI_API_KEY`
  - `GEMINI_MODEL` optional
- DeepSeek:
  - `DEEPSEEK_API_KEY`
  - `DEEPSEEK_BASE_URL` optional
  - `DEEPSEEK_MODEL` optional

SEO provider credentials:

- `SERPER_API_KEY` for manual live SERP checks on the analytics page

### Example `.env`

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/diyseo"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

AI_PROVIDER="deepseek"

DEEPSEEK_API_KEY="your-deepseek-key"
DEEPSEEK_BASE_URL="https://api.deepseek.com"
DEEPSEEK_MODEL="deepseek-chat"

GEMINI_API_KEY=""
GEMINI_MODEL="gemini-1.5-flash"

SERPER_API_KEY=""
```

## Local PostgreSQL Setup

Example local database creation for Orbstack or any local PostgreSQL server:

```bash
createdb diyseo
```

Or explicitly via `psql`:

```bash
psql postgres -c 'CREATE DATABASE diyseo;'
```

Example local connection string:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/diyseo"
```

## Install And Run

### Install

```bash
npm install
```

### Migrate

Apply committed migrations:

```bash
npm run prisma:migrate:deploy
```

For local schema development only:

```bash
npm run prisma:migrate
```

### Seed

Seed the default workspace, demo site, Brand DNA shell, and demo articles:

```bash
npm run prisma:seed
```

### Development

```bash
npm run dev
```

### Production

```bash
npm run build
npm run start
```

Docker Compose is available for the app container:

```bash
docker compose up --build
```

Notes:

- The container does not provision PostgreSQL for you.
- The container does not run migrations automatically.
- Run `npm run prisma:migrate:deploy` before serving production traffic.
- Run `npm run prisma:seed` only if you want demo content in that environment.
- Set `NEXT_PUBLIC_APP_URL` to your final public origin so canonical URLs, feeds, sitemap, and robots metadata use absolute links.

## Fresh Setup Flow

From a clean database:

```bash
cp .env.example .env
npm install
npm run prisma:migrate:deploy
npm run prisma:seed
npm run build
npm run dev
```

## Admin App Overview

The admin app gives each site its own workflow:

- Dashboard
- Brand DNA
- Articles
- Manual editor
- Keywords
- Calendar
- Analytics
- Site onboarding

Primary admin routes:

- `/settings`
- `/new-site`
- `/:siteId`
- `/:siteId/brand-dna`
- `/:siteId/articles`
- `/:siteId/articles/:articleId`
- `/:siteId/articles/new`
- `/:siteId/keywords`
- `/:siteId/calendar`
- `/:siteId/analytics`

## Public Blog Overview

Public site routes:

- `/blog`
- `/blog/:siteId`
- `/blog/:siteId/:slug`
- `/blog/:siteId/rss.xml`
- `/blog/:siteId/atom.xml`
- `/blog/:siteId/sitemap.xml`
- `/blog/robots.txt`

## Example Embed Snippet

Embed the published article widget on any page:

```html
<div id="soro-widget-container"></div>
<script
  src="https://your-app.example.com/embed.js"
  data-site="your-site-id"
  data-base-path="/blog"
  data-theme="default"
  data-title="Latest Articles"
></script>
```

Notes:

- `data-site` and `data-base-path` are required bootstrap inputs
- `data-theme` and `data-title` are optional overrides
- Script attributes override API-provided widget config

## Example Public API Usage

List published articles:

```bash
curl http://localhost:3000/api/public/sites/<siteId>/articles
```

Get one published article by slug:

```bash
curl http://localhost:3000/api/public/sites/<siteId>/articles/<slug>
```

Get widget/public site config:

```bash
curl http://localhost:3000/api/public/sites/<siteId>/config
```

Example response shape for article detail:

```json
{
  "siteId": "site_id",
  "article": {
    "id": "article_id",
    "title": "Example Article",
    "slug": "example-article",
    "excerpt": "Short summary",
    "contentHtml": "<h2>Heading</h2><p>Body</p>",
    "seoTitle": "Example SEO Title",
    "seoDescription": "Example SEO description",
    "status": "PUBLISHED",
    "publishedAt": "2026-04-22T09:00:00.000Z",
    "siteProjectId": "site_id"
  }
}
```

## Screenshots

Release screenshots are not included yet.

Suggested screenshots for the first GitHub release:

- Admin dashboard
- Brand DNA editor
- Articles list and manual editor
- Calendar view
- Public blog index
- Public article detail page
- Widget embedded on a demo page

If image assets are added later, place them in a stable docs or repository path and link them from this section.

## Known Limitations

- Authentication and multi-user permissions are not included in v1
- The analytics view is foundational, not a full reporting suite
- AI output quality depends on provider behavior and prompt fit
- AI article generation can be slow depending on the provider
- The widget is intentionally minimal and is not a full theming system
- Draft/published workflows are simple and do not include revision history
- Keyword management is lightweight and does not yet provide clustering, search volume, or SERP data
- Production operators must run migrations themselves before serving traffic

## Contributing

Contributions are welcome, especially around:

- setup and deployment improvements
- UX polish
- feed/search/discoverability hardening
- test coverage
- self-hosting docs
- provider integrations that fit the existing abstraction

Before opening a PR:

1. Install dependencies.
2. Run migrations against a local PostgreSQL database.
3. Run the seed script if you want demo data.
4. Verify the app builds cleanly.

Useful commands:

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:migrate:deploy
npm run prisma:seed
npm run build
npm run start
```

Please keep changes focused, avoid unnecessary schema churn, and preserve the existing public API and widget contracts unless a change is clearly justified.

## Auto-Publish Cron

Trigger the internal auto-publish scheduler with:

```bash
curl -X POST https://yourdomain.com/api/internal/cron/auto-publish \
  -H "Authorization: Bearer $CRON_SECRET"
```

The scheduler only processes sites with `autoPublishEnabled=true`, counts this week's `AUTO` articles against each site's `articlesPerWeek` target, and caps each run to 5 generated articles total.

## Release Notes Guidance

Suggested one-line GitHub description:

> Self-hosted SEO workspace with AI-assisted article generation, Brand DNA, editorial workflow, public blog publishing, and an embeddable widget.

Suggested short release summary:

> DIYSEO is a self-hosted publishing and SEO workspace for teams that want to own their content stack end to end, from brand context and AI drafts to a live public blog, feeds, and embedded article widgets.

## Release Gaps To Consider

Before a broad public launch, you may still want:

- a license file
- issue and pull request templates
- CI for build and migration checks
- real screenshots or GIFs
- a changelog and tagged release notes

The app itself is documented and packaged well enough for an initial public repository release, but those additions would improve open-source adoption.
