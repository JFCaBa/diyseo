# Slice 10 Architecture Plan: Analytics Foundations

## 1. Objective
Define the architecture for Slice 10, which introduces the foundational Analytics dashboard. This feature provides a high-level overview of a site's content and keyword metrics, alongside a recent activity feed.

## 2. Scope & Constraints
*   **Included**: Site-level metrics (Total/Published/Draft articles, Total/Used keywords), recent article activity list, and the UI for the `/[siteId]/analytics` page.
*   **Constraints**: No changes to the public API, embeddable widget, or AI logic. Must remain read-only for metrics and stable.

## 3. Database Usage & Aggregation (Prisma)

The analytics dashboard requires querying and aggregating data from the existing `Article` and `Keyword` models for a specific `siteProjectId`.

### 3.1. Required Queries
We will use Prisma's aggregate and count functions to efficiently retrieve these metrics.

*   **Articles Metrics**:
    ```typescript
    const articleMetrics = await prisma.article.groupBy({
      by: ['status'],
      where: { siteProjectId: siteId },
      _count: { id: true },
    });
    // Calculate Total = sum of counts, Published = count where status === 'PUBLISHED', Draft = count where status === 'DRAFT'
    ```
*   **Keywords Metrics**:
    ```typescript
    const keywordMetrics = await prisma.keyword.groupBy({
      by: ['status'],
      where: { siteProjectId: siteId },
      _count: { id: true },
    });
    // Calculate Total = sum of counts, Used = count where status === 'USED'
    ```
*   **Recent Activity Feed**:
    ```typescript
    const recentActivity = await prisma.article.findMany({
      where: { siteProjectId: siteId },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: { id: true, title: true, status: true, updatedAt: true },
    });
    ```

## 4. Internal API / Server Component Design

Since this is a read-only dashboard, we will leverage Next.js **Server Components** to fetch this data directly on the server during the render of the `/[siteId]/analytics` page. No new API routes or Server Actions for mutations are required.

### 4.1. Data Fetching Logic (Server Component)
The `page.tsx` for the analytics route will:
1.  Extract `siteId` from the route params.
2.  Execute the Prisma queries defined above in parallel using `Promise.all` for performance.
3.  Pass the aggregated data down to presentation components.

## 5. UI Behavior (`/[siteId]/analytics`)

*   **Metrics Overview (Cards)**:
    *   A grid of simple cards displaying the top-level numbers:
        *   Total Articles
        *   Published Articles
        *   Draft Articles
        *   Total Keywords
        *   Keywords Used
*   **Recent Activity List**:
    *   A list or minimal table below the metrics showing the 5 most recently updated articles.
    *   Displays the Article Title, current Status (`DRAFT` or `PUBLISHED`), and the `updatedAt` timestamp (formatted as "2 hours ago" or a date).
    *   Clicking an item in the recent activity list should ideally navigate the user to that article's editor (`/[siteId]/articles/[articleId]`).

## 6. Validation Rules (Zod)

While there are no input forms to validate for data mutation, we should still ensure the `siteId` parameter is valid before querying the database.

```typescript
import { z } from 'zod';

export const AnalyticsRouteParamsSchema = z.object({
  siteId: z.string().cuid("Invalid Site ID"),
});
```

## 7. Acceptance Criteria
*   [ ] The `/[siteId]/analytics` route renders a dashboard view.
*   [ ] The dashboard accurately displays the count of Total Articles, Published Articles, and Draft Articles for the active site.
*   [ ] The dashboard accurately displays the count of Total Keywords and Used Keywords for the active site.
*   [ ] A "Recent Activity" section displays the 5 most recently updated articles for the active site.
*   [ ] The Recent Activity list shows the article title, status, and last updated time.
*   [ ] Data is fetched efficiently on the server without requiring client-side API calls.
*   [ ] The public API and embeddable widget remain entirely unaffected.