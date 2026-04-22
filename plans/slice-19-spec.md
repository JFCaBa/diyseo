# Slice 19 Architecture Plan: Sitemap for Public Blog

## 1. Objective
Define the architecture for Slice 19, which introduces an automatic XML sitemap endpoint for each public blog. This feature is crucial for Search Engine Optimization (SEO), ensuring that search engine crawlers can easily discover and index the blog index page and all published article pages.

## 2. Scope & Constraints
*   **Included**: A new Next.js Route Handler (`/blog/[siteId]/sitemap.xml`), server-side generation of a valid XML sitemap, querying only published articles.
*   **Included URLs**: The blog index page (`/blog/[siteId]`) and detail pages for every published article (`/blog/[siteId]/[slug]`).
*   **Constraints**: Only `PUBLISHED` articles are accessible. No changes to the existing public API, widget, or AI generation logic. Must remain minimal, fast, and conform to the standard Sitemap XML protocol.

## 3. Route Behavior & DB Usage

### 3.1. Route Definition
*   **Path**: `app/blog/[siteId]/sitemap.xml/route.ts` (Next.js App Router API Route).
*   **Type**: GET Request Handler.
*   **Response**: `Content-Type: application/xml` (or `text/xml`).

### 3.2. Database Query
The route will fetch the `SiteProject` details (to verify it exists) and a list of published articles from Prisma to construct the URLs.

```typescript
// Verify Site Exists
const site = await prisma.siteProject.findUnique({
  where: { id: siteId },
  select: { id: true, updatedAt: true }
});

if (!site) {
  return new Response("Site not found", { status: 404 });
}

// Fetch Published Articles
const articles = await prisma.article.findMany({
  where: {
    siteProjectId: siteId,
    status: 'PUBLISHED', // Crucial: Never include drafts in the sitemap
  },
  select: {
    slug: true,
    updatedAt: true, // Use updatedAt for the <lastmod> tag
  },
  orderBy: {
    publishedAt: 'desc'
  }
});
```

## 4. XML Output Rules

The output must conform strictly to the Sitemap XML protocol (`http://www.sitemaps.org/schemas/sitemap/0.9`). Absolute URLs must be constructed using the `NEXT_PUBLIC_APP_URL` environment variable.

### 4.1. Output Generation Logic
1.  **Index URL**: The first `<url>` block must be the blog's index page. Its `<lastmod>` can be the `updatedAt` of the site itself, or the most recent `updatedAt` of its articles.
2.  **Article URLs**: Loop through the fetched articles and output a `<url>` block for each.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Blog Index Page -->
  <url>
    <loc>{NEXT_PUBLIC_APP_URL}/blog/{siteId}</loc>
    <lastmod>{mostRecentArticleUpdatedAt || site.updatedAt.toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  
  <!-- Loop through published articles -->
  <url>
    <loc>{NEXT_PUBLIC_APP_URL}/blog/{siteId}/{article.slug}</loc>
    <lastmod>{article.updatedAt.toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <!-- End Loop -->
</urlset>
```

## 5. Empty-State Behavior
If a site exists but has no published articles, the sitemap must still be generated. It will contain exactly one `<url>` entry: the blog index page. This ensures crawlers still find the root blog page.

## 6. Validation Rules (Zod)

Validate the `siteId` route parameter before querying the database.

```typescript
import { z } from 'zod';

export const SitemapRouteParamsSchema = z.object({
  siteId: z.string().cuid("Invalid Site ID"),
});
```

## 7. Acceptance Criteria
*   [ ] A GET request to `/blog/[siteId]/sitemap.xml` returns a valid XML sitemap response.
*   [ ] The response `Content-Type` header is set to `application/xml` or `text/xml`.
*   [ ] The sitemap always includes an entry for the blog index page (`/blog/[siteId]`).
*   [ ] The sitemap includes an entry for every article with a `PUBLISHED` status.
*   [ ] The sitemap strictly excludes any article with a `DRAFT` status.
*   [ ] All `<loc>` URLs are absolute, utilizing the application's base URL environment variable.
*   [ ] If a valid site has no published articles, it returns a valid sitemap containing only the index page URL.
*   [ ] Attempting to fetch the sitemap for an invalid `siteId` returns a 404 response.
*   [ ] The existing `/api/public/...` endpoints and the embeddable widget remain entirely unaffected.