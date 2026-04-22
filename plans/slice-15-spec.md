# Slice 15 Architecture Plan: Public Article Detail Page

## 1. Objective
Define the architecture for Slice 15, introducing a public-facing, server-rendered article detail page hosted directly on the platform. This provides a native fallback or alternative for viewing content without requiring the embeddable widget on a third-party host.

## 2. Scope & Constraints
*   **Included**: A new dynamic route (`/blog/[siteId]/[slug]`), server-side data fetching for published articles, SEO metadata injection, and a minimal reading layout.
*   **Fields Rendered**: `title`, `excerpt`, `content` (stored as HTML), `seoTitle`, `seoDescription`.
*   **Constraints**: Only `PUBLISHED` articles are accessible. No changes to the existing public API, widget, or AI generation logic. Must remain minimal, fast, and SEO-friendly.

## 3. Route Behavior & DB Usage

### 3.1. Route Definition
*   **Path**: `app/blog/[siteId]/[slug]/page.tsx` (using Next.js App Router).
*   **Type**: Server Component.

### 3.2. Database Query
The page will fetch the article directly from Prisma during the server render phase.

```typescript
const article = await prisma.article.findFirst({
  where: {
    siteProjectId: siteId,
    slug: slug,
    status: 'PUBLISHED', // Crucial: Never serve drafts publicly
  },
  select: {
    title: true,
    excerpt: true,
    content: true,
    seoTitle: true,
    seoDescription: true,
    publishedAt: true,
    siteProject: { select: { name: true } }, // Optional context
  }
});
```

### 3.3. Not-Found Behavior
If the Prisma query returns `null` (because the slug doesn't exist, belongs to a different site, or is in `DRAFT` status), the component must immediately call Next.js's `notFound()` function to return a 404 response.

## 4. Metadata Handling (SEO)
To ensure the page is indexable, we will use Next.js's `generateMetadata` API to inject the stored SEO fields into the document `<head>`.

```typescript
// Conceptual Implementation
export async function generateMetadata({ params }): Promise<Metadata> {
  const article = await fetchArticle(params.siteId, params.slug);
  if (!article) return {};

  return {
    title: article.seoTitle || article.title,
    description: article.seoDescription || article.excerpt,
    // Add OpenGraph / Twitter tags if necessary
  };
}
```

## 5. UI Layout
The page should feature a clean, minimal "reading" layout.
*   **Header**: Display the `title`. Optionally display the `publishedAt` date.
*   **Excerpt**: Display the `excerpt` (styled slightly larger or italicized as a lead-in).
*   **Content**: Safely inject the raw HTML stored in the `content` field. In React/Next.js, this uses `dangerouslySetInnerHTML={{ __html: article.content }}`. Ensure the container has basic typography styles applied (e.g., using Tailwind's `prose` plugin).

## 6. Validation Rules (Zod)

Validate the route parameters to ensure they are correctly formatted before querying the database.

```typescript
import { z } from 'zod';

export const PublicArticleRouteParamsSchema = z.object({
  siteId: z.string().cuid("Invalid Site ID"),
  slug: z.string().min(1).max(100),
});
```

## 7. Acceptance Criteria
*   [ ] A user can visit `/blog/[siteId]/[slug]` and see a published article.
*   [ ] The page is completely server-rendered for SEO benefits.
*   [ ] The page `<title>` and `<meta name="description">` tags use the `seoTitle` and `seoDescription` fields (falling back to `title` and `excerpt` if empty).
*   [ ] The article content (`contentHtml`) is rendered correctly on the page.
*   [ ] Attempting to visit a `DRAFT` article or an invalid slug returns a 404 Not Found page.
*   [ ] The existing `/api/public/...` endpoints and the embeddable widget remain entirely unaffected.