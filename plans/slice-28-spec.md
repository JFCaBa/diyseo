# Slice 28 Architecture Plan: Public Blog Article Navigation

## 1. Objective
Define the architecture for Slice 28, focusing on adding cohesive article-to-article navigation on the public-facing blog detail page (`/blog/[siteId]/[slug]`). This enhances discoverability and encourages readers to consume more content by providing easy access to the previous and next published articles, as well as a clear link back to the main blog index.

## 2. Scope & Constraints
*   **Included**: "Previous Article" and "Next Article" links, plus a "Back to Blog" index link on the article detail page.
*   **Constraints**: Must only surface `PUBLISHED` articles. Must respect chronological ordering (`publishedAt` then `createdAt`). No widget, public API, or AI changes. Must remain minimal, stable, and rely purely on existing database structures.

## 3. Database Usage & Ordering Rules

To display "Previous" (older) and "Next" (newer) articles relative to the current article being viewed, two supplementary Prisma queries are required on the server side. 

### 3.1. Ordering Logic
The global ordering for the blog is descending by publication date (newest first). 
When viewing an article (Article A):
*   **Previous (Older)**: The article published immediately *before* Article A.
*   **Next (Newer)**: The article published immediately *after* Article A.

Because `publishedAt` could theoretically be identical (or null if the schema allows, though we enforce it on publish), we use `createdAt` as a secondary fallback to guarantee deterministic ordering.

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
  select: { title: true, slug: true }
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
  select: { title: true, slug: true }
});
```

## 4. UI Behavior & Edge Cases

### 4.1. Layout & Placement
*   **Location**: Directly beneath the main article content (and ideally above the footer created in Slice 27).
*   **Layout**: A simple flex container or grid splitting the space. 
    *   Left side: `← Previous: [Article Title]`
    *   Right side: `Next: [Article Title] →`
    *   Center or Top/Bottom: "Back to Blog Index" link (improving upon the simple link mentioned in Slice 20).

### 4.2. Edge Case (Empty State) Behavior
*   **Oldest Article**: The `previousArticle` query will return `null`. The "Previous" link UI must be hidden or gracefully omitted.
*   **Newest Article**: The `nextArticle` query will return `null`. The "Next" link UI must be hidden or gracefully omitted.
*   **Only One Article**: Both will return `null`. Only the "Back to Blog Index" link will be displayed.

## 5. Acceptance Criteria
*   [ ] The `/blog/[siteId]/[slug]` route executes queries to fetch the immediate chronologically adjacent published articles.
*   [ ] The bottom of the article displays a "Previous" link pointing to the older article's slug, showing its title.
*   [ ] The bottom of the article displays a "Next" link pointing to the newer article's slug, showing its title.
*   [ ] If the current article is the oldest, the "Previous" link does not render.
*   [ ] If the current article is the newest, the "Next" link does not render.
*   [ ] A "Back to Blog Index" link is prominently displayed in the navigation area.
*   [ ] Draft articles are never fetched or displayed in this navigation flow.
*   [ ] The embeddable widget and public `/api/public/...` API remain entirely unaffected.