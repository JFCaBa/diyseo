# Slice 16 Architecture Plan: Public Blog Index Page

## 1. Objective
Define the architecture for Slice 16, introducing a public-facing, server-rendered blog index page hosted directly on the platform. This provides a native list view of all published articles for a given site, complementing the detail page created in Slice 15.

## 2. Scope & Constraints
*   **Included**: A new dynamic route (`/blog/[siteId]`), server-side data fetching for published articles, SEO metadata handling for the index page, and empty-state behavior.
*   **Fields Rendered per Article**: `title`, `excerpt`, `publishedAt`, and a link to the article detail page (`/blog/[siteId]/[slug]`).
*   **Constraints**: Only `PUBLISHED` articles are accessible. No changes to the existing public API, widget, or AI generation logic. Must remain minimal, fast, and SEO-friendly.

## 3. Route Behavior & DB Usage

### 3.1. Route Definition
*   **Path**: `app/blog/[siteId]/page.tsx` (using Next.js App Router).
*   **Type**: Server Component.

### 3.2. Database Query
The page will fetch the list of published articles directly from Prisma during the server render phase. It will also fetch basic site info for the header/metadata.

```typescript
// Fetch Site Info
const site = await prisma.siteProject.findUnique({
  where: { id: siteId },
  select: { name: true, domain: true }
});

// If site doesn't exist, return 404
if (!site) return notFound();

// Fetch Articles
const articles = await prisma.article.findMany({
  where: {
    siteProjectId: siteId,
    status: 'PUBLISHED', // Crucial: Never list drafts publicly
  },
  select: {
    id: true,
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

### 3.3. Empty-State Behavior
If the Prisma query for articles returns an empty array, the page should render a friendly empty state message (e.g., "No articles published yet."). It should NOT return a 404 as long as the `siteId` is valid.

### 3.4. Not-Found Behavior
If the Prisma query for the `SiteProject` returns `null` (because the `siteId` doesn't exist), the component must immediately call Next.js's `notFound()` function to return a 404 response.

## 4. Metadata Handling (SEO)
To ensure the index page is indexable, use Next.js's `generateMetadata` API to inject SEO fields.

```typescript
// Conceptual Implementation
export async function generateMetadata({ params }): Promise<Metadata> {
  const site = await fetchSite(params.siteId);
  if (!site) return {};

  return {
    title: `${site.name} - Blog`,
    description: `Read the latest articles from ${site.name}.`,
  };
}
```

## 5. UI Layout
The page should feature a clean, minimal list layout.
*   **Header**: Display the `SiteProject` name (e.g., "{Site Name} Blog").
*   **List**: Iterate over the fetched articles and render a card or list item for each.
*   **Article Item**: 
    *   Display the `title` as a clickable link pointing to `/blog/[siteId]/[slug]`.
    *   Display the `publishedAt` date, formatted legibly.
    *   Display the `excerpt` below the title/date.

## 6. Validation Rules (Zod)

Validate the route parameters to ensure the `siteId` is correctly formatted.

```typescript
import { z } from 'zod';

export const PublicBlogIndexRouteParamsSchema = z.object({
  siteId: z.string().cuid("Invalid Site ID"),
});
```

## 7. Acceptance Criteria
*   [ ] A user can visit `/blog/[siteId]` and see a list of published articles for that site.
*   [ ] The page is completely server-rendered for SEO benefits.
*   [ ] The page `<title>` and `<meta name="description">` tags use the site's name appropriately.
*   [ ] Each article item displays its title, excerpt, and published date.
*   [ ] The title of each article links to its respective detail page (`/blog/[siteId]/[slug]`).
*   [ ] Attempting to visit the index for an invalid `siteId` returns a 404 Not Found page.
*   [ ] Visiting the index for a valid site with no published articles displays a friendly empty state.
*   [ ] Draft articles are never displayed on this index page.
*   [ ] The existing `/api/public/...` endpoints and the embeddable widget remain entirely unaffected.