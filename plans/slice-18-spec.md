# Slice 18 Architecture Plan: RSS Feed for Published Articles

## 1. Objective
Define the architecture for Slice 18, introducing an RSS feed endpoint for each public blog. This enables content syndication and allows external readers and services to subscribe to updates from the platform.

## 2. Scope & Constraints
*   **Included**: A new Next.js Route Handler (`/blog/[siteId]/rss.xml`), server-side generation of an RSS 2.0 XML payload, querying only published articles, and handling empty feeds.
*   **Fields Rendered per Article**: `title`, `link` (absolute URL), `description` (excerpt), and `pubDate`.
*   **Constraints**: Only `PUBLISHED` articles are accessible. No changes to the existing public API, widget, or AI generation logic. Must remain minimal and conform to RSS 2.0 standards.

## 3. Route Behavior & DB Usage

### 3.1. Route Definition
*   **Path**: `app/blog/[siteId]/rss.xml/route.ts` (Next.js App Router API Route).
*   **Type**: GET Request Handler.
*   **Response**: `Content-Type: text/xml` (or `application/rss+xml`).

### 3.2. Database Query
The route will fetch the `SiteProject` details and a list of published articles from Prisma.

```typescript
// Fetch Site Info
const site = await prisma.siteProject.findUnique({
  where: { id: siteId },
  select: { name: true, domain: true }
});

if (!site) {
  return new Response("Site not found", { status: 404 });
}

// Fetch Articles
const articles = await prisma.article.findMany({
  where: {
    siteProjectId: siteId,
    status: 'PUBLISHED', // Crucial: Never include drafts
  },
  select: {
    title: true,
    excerpt: true,
    slug: true,
    publishedAt: true,
  },
  orderBy: {
    publishedAt: 'desc' // Most recent first
  }
});
```

### 3.3. Empty-Feed Behavior
If the site exists but has no published articles, the route should return a valid, well-formed RSS XML document with the channel metadata (title, link, description) but no `<item>` elements.

## 4. XML Output Rules

The output must be a valid RSS 2.0 XML string. Absolute URLs must be constructed using the `NEXT_PUBLIC_APP_URL` environment variable.

```xml
<rss version="2.0">
  <channel>
    <title>{site.name} Blog</title>
    <link>{NEXT_PUBLIC_APP_URL}/blog/{siteId}</link>
    <description>Latest articles from {site.name}</description>
    <!-- Loop through articles -->
    <item>
      <title><![CDATA[{article.title}]]></title>
      <link>{NEXT_PUBLIC_APP_URL}/blog/{siteId}/{article.slug}</link>
      <description><![CDATA[{article.excerpt}]]></description>
      <pubDate>{article.publishedAt.toUTCString()}</pubDate>
    </item>
    <!-- End Loop -->
  </channel>
</rss>
```
*Note: `CDATA` is recommended for titles and descriptions to safely wrap potentially problematic characters.*

## 5. Validation Rules (Zod)

Validate the `siteId` route parameter before processing the request.

```typescript
import { z } from 'zod';

export const RSSRouteParamsSchema = z.object({
  siteId: z.string().cuid("Invalid Site ID"),
});
```

## 6. Acceptance Criteria
*   [ ] A GET request to `/blog/[siteId]/rss.xml` returns a valid RSS 2.0 XML response.
*   [ ] The response `Content-Type` header is set to `text/xml` or `application/rss+xml`.
*   [ ] The RSS feed includes a `<channel>` with the site's name and an absolute link to the blog index.
*   [ ] The RSS feed includes `<item>` tags only for articles with a `PUBLISHED` status.
*   [ ] Each `<item>` contains a `title`, an absolute `link` to the article detail page, a `description` (mapped from the excerpt), and a `pubDate`.
*   [ ] If a valid site has no published articles, it returns an empty but valid RSS `<channel>`.
*   [ ] Attempting to fetch the RSS feed for an invalid `siteId` returns a 404 response.
*   [ ] The existing `/api/public/...` endpoints and the embeddable widget remain entirely unaffected.
