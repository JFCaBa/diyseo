# Slice 29 Architecture Plan: Public Blog Article Metadata Polish

## 1. Objective
Define the architecture for Slice 29, which focuses on enhancing the SEO metadata of the public-facing blog detail page (`/blog/[siteId]/[slug]`). This slice introduces semantic link relations (`rel="prev"` and `rel="next"`) to the document `<head>`, signaling the chronological relationship between articles to search engines.

## 2. Scope & Constraints
*   **Included**: Enhancing the `generateMetadata` function for `/blog/[siteId]/[slug]` to output `prev` and `next` link tags based on chronologically adjacent published articles.
*   **Constraints**: Must use the exact same ordering logic established in Slice 28 (`publishedAt`, fallback to `createdAt`). No changes to UI components, the public API, the embeddable widget, or AI generation logic. Must remain minimal and stable.

## 3. Database Usage & Ordering Rules

The logic for determining the "previous" and "next" articles is identical to the visual navigation implemented in Slice 28. To avoid duplicating heavy queries, the data fetching strategy should ideally be unified if the Next.js cache doesn't naturally handle it, but conceptually, the queries remain the same.

### 3.1. Ordering Logic
*   **Previous (Older)**: The article published immediately *before* the current article.
*   **Next (Newer)**: The article published immediately *after* the current article.
*   **Fallback**: If `publishedAt` is identical, `createdAt` is used as the tie-breaker to ensure deterministic, stable ordering.

### 3.2. Prisma Queries
Assume `currentArticle` is the currently rendered article.

```typescript
// 1. Query for the "Previous" (Older) Article
const previousArticle = await prisma.article.findFirst({
  where: {
    siteProjectId: siteId,
    status: 'PUBLISHED',
    OR: [
      { publishedAt: { lt: currentArticle.publishedAt } },
      { 
        publishedAt: currentArticle.publishedAt, 
        createdAt: { lt: currentArticle.createdAt } 
      }
    ],
  },
  orderBy: [
    { publishedAt: 'desc' },
    { createdAt: 'desc' }
  ],
  select: { slug: true } // We only need the slug for the URL
});

// 2. Query for the "Next" (Newer) Article
const nextArticle = await prisma.article.findFirst({
  where: {
    siteProjectId: siteId,
    status: 'PUBLISHED',
    OR: [
      { publishedAt: { gt: currentArticle.publishedAt } },
      { 
        publishedAt: currentArticle.publishedAt, 
        createdAt: { gt: currentArticle.createdAt } 
      }
    ],
  },
  orderBy: [
    { publishedAt: 'asc' },
    { createdAt: 'asc' }
  ],
  select: { slug: true }
});
```

## 4. Metadata Rules & Edge-Case Behavior

We will update the Next.js `generateMetadata` function (introduced in Slice 17) to include the `archives` property (or manually inject `alternate` link tags if `archives` isn't fully supported by the specific Next.js version, though standard `alternates` configuration usually covers this).

### 4.1. Implementation Strategy

```typescript
import { Metadata } from 'next';

export async function generateMetadata({ params }): Promise<Metadata> {
  // ... existing fetch logic for the current article and base metadata (Slice 17)

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  
  // Fetch adjacent articles (using the queries defined above)
  const prevArticle = await getPreviousArticle(siteId, currentArticle);
  const nextArticle = await getNextArticle(siteId, currentArticle);

  const alternates: Metadata['alternates'] = {
    canonical: `${baseUrl}/blog/${params.siteId}/${params.slug}`,
  };

  // Add Previous Link Relation
  if (prevArticle) {
    // Next.js historically handles prev/next via custom objects or direct link injection
    // Using the modern alternates API (if supported) or extending standard metadata
    // Often represented semantically in HTML as <link rel="prev" href="..." />
    // If Next.js alternates doesn't natively support prev/next easily, 
    // it can be managed via custom head tags, but standard metadata is preferred.
    
    // Conceptually adding to metadata:
    // This assumes support or a custom wrapper for <link rel="prev">
    // Some implementations use `other` for arbitrary tags if `alternates` lacks it.
  }

  // Next.js App Router specific implementation using `other` for custom link tags 
  // if standard properties don't cover rel="prev" / rel="next"
  const otherMetaData: Record<string, string> = {};
  
  if (prevArticle) {
     // NOTE: Depending on Next.js version, this might require a different injection method 
     // if 'other' only supports <meta> and not <link>. 
     // Standard approach might require returning a structured object if supported.
  }

  return {
    // ... existing metadata (title, description, openGraph)
    alternates,
    // Note: The specific implementation detail of injecting <link rel="prev"> in Next.js App Router 
    // requires verifying if `alternates` supports `prev`/`next` directly or if it needs to be 
    // handled via `head.tsx` (deprecated) or by returning a specific object structure.
    // For this architecture plan, the requirement is that the tags exist in the DOM.
  };
}
```

*Architectural Note on Next.js Support*: If Next.js `Metadata` API does not natively support `rel="prev"` and `rel="next"` easily via the standard `alternates` object, the implementation will ensure they are injected safely, potentially using custom components or workarounds compliant with App Router rules to ensure standard HTML compliance.

### 4.2. Edge Cases (Empty States)
*   **Oldest Article**: The `previousArticle` query returns `null`. The `rel="prev"` tag is **not** included in the metadata.
*   **Newest Article**: The `nextArticle` query returns `null`. The `rel="next"` tag is **not** included in the metadata.
*   **Only One Article**: Both queries return `null`. Neither tag is included.

## 5. Validation Rules
*   Ensure that the URLs generated for the `prev` and `next` links are absolute, utilizing the `NEXT_PUBLIC_APP_URL` environment variable.
*   Ensure that the links point to the correct, existing slugs for the adjacent articles.

## 6. Acceptance Criteria
*   [ ] The `/blog/[siteId]/[slug]` route's `generateMetadata` function executes queries to determine the previous and next published articles based on `publishedAt` and `createdAt`.
*   [ ] If a previous (older) article exists, a `<link rel="prev" href="[ABSOLUTE_URL]" />` tag is rendered in the document `<head>`.
*   [ ] If a next (newer) article exists, a `<link rel="next" href="[ABSOLUTE_URL]" />` tag is rendered in the document `<head>`.
*   [ ] If the current article is the oldest, no `rel="prev"` tag is rendered.
*   [ ] If the current article is the newest, no `rel="next"` tag is rendered.
*   [ ] Draft articles are never considered when calculating adjacent articles for metadata.
*   [ ] The embeddable widget and public `/api/public/...` API remain entirely unaffected.