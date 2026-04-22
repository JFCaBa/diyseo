# Slice 25 Architecture Plan: Atom Feed for Published Articles

## 1. Objective
Define the architecture for Slice 25, introducing an Atom feed endpoint for each public blog. This complements the RSS feed introduced in Slice 18, providing an alternative syndication format preferred by many modern readers and automated ingestion services.

## 2. Scope & Constraints
*   **Included**: A new Next.js Route Handler (`/blog/[siteId]/atom.xml`), server-side generation of an Atom 1.0 XML payload, querying only published articles, and handling empty feeds.
*   **Fields Rendered per Article**: `title`, `link` (absolute URL), `summary` (excerpt), `published` (published date), and `updated` (updated date).
*   **Constraints**: Only `PUBLISHED` articles are accessible. The existing RSS route (`/blog/[siteId]/rss.xml`) must remain untouched. No changes to the existing public API, widget, or AI generation logic. Must remain minimal and conform strictly to Atom 1.0 standards.

## 3. Route Behavior & DB Usage

### 3.1. Route Definition
*   **Path**: `app/blog/[siteId]/atom.xml/route.ts` (Next.js App Router API Route).
*   **Type**: GET Request Handler.
*   **Response**: `Content-Type: application/atom+xml` (or `text/xml`).

### 3.2. Database Query
The route will fetch the `SiteProject` details and a list of published articles from Prisma, identical in structure to the RSS feed query.

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
    updatedAt: true,
  },
  orderBy: {
    publishedAt: 'desc' // Most recent first
  }
});
```

### 3.3. Empty-Feed Behavior
If the site exists but has no published articles, the route should return a valid, well-formed Atom XML document containing the `<feed>` metadata (title, link, updated, author) but no `<entry>` elements.

## 4. XML Output Rules

The output must be a valid Atom 1.0 XML string. Absolute URLs must be constructed using the `NEXT_PUBLIC_APP_URL` environment variable. Dates in Atom must strictly follow the RFC 3339 / ISO 8601 format (e.g., `article.publishedAt.toISOString()`).

```xml
<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>{site.name} Blog</title>
  <link href="{NEXT_PUBLIC_APP_URL}/blog/{siteId}/atom.xml" rel="self"/>
  <link href="{NEXT_PUBLIC_APP_URL}/blog/{siteId}"/>
  <updated>{mostRecentArticleUpdatedAt || new Date().toISOString()}</updated>
  <id>{NEXT_PUBLIC_APP_URL}/blog/{siteId}</id>
  <author>
    <name>{site.name}</name>
  </author>
  
  <!-- Loop through articles -->
  <entry>
    <title><![CDATA[{article.title}]]></title>
    <link href="{NEXT_PUBLIC_APP_URL}/blog/{siteId}/{article.slug}"/>
    <id>{NEXT_PUBLIC_APP_URL}/blog/{siteId}/{article.slug}</id>
    <updated>{article.updatedAt.toISOString()}</updated>
    <published>{article.publishedAt.toISOString()}</published>
    <summary><![CDATA[{article.excerpt}]]></summary>
  </entry>
  <!-- End Loop -->
</feed>
```
*Note: `CDATA` is recommended for titles and summaries to safely wrap potentially problematic characters. `<id>` should generally be the permalink URL of the resource.*

## 5. Validation Rules (Zod)

Validate the `siteId` route parameter before processing the request.

```typescript
import { z } from 'zod';

export const AtomRouteParamsSchema = z.object({
  siteId: z.string().cuid("Invalid Site ID"),
});
```

## 6. Acceptance Criteria
*   [ ] A GET request to `/blog/[siteId]/atom.xml` returns a valid Atom 1.0 XML response.
*   [ ] The response `Content-Type` header is set to `application/atom+xml` or `text/xml`.
*   [ ] The Atom feed includes a `<feed>` block with the site's name, a `self` link, and an absolute link to the blog index.
*   [ ] The Atom feed includes `<entry>` tags only for articles with a `PUBLISHED` status.
*   [ ] Each `<entry>` contains a `<title>`, an absolute `<link>`, a unique `<id>`, an `<updated>` date, a `<published>` date, and a `<summary>` (mapped from the excerpt).
*   [ ] All dates are strictly formatted as ISO 8601 strings.
*   [ ] If a valid site has no published articles, it returns an empty but valid Atom `<feed>`.
*   [ ] Attempting to fetch the Atom feed for an invalid `siteId` returns a 404 response.
*   [ ] The existing `/blog/[siteId]/rss.xml` endpoint and all other functionality remain entirely unaffected.
