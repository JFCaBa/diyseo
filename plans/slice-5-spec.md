# Slice 5 Architecture Plan: Article Publishing Workflow

## 1. Objective
Define the architecture for Slice 5, focusing on the ability to toggle an article's state between Draft and Published. This ensures the public API (defined in Slice 2) and the embeddable widget (defined in Slice 3) only expose intended content.

## 2. Scope & Constraints
*   **Included**: State transitions (`DRAFT` <-> `PUBLISHED`), managing the `publishedAt` timestamp, internal API endpoint/action for status updates, and minimal UI integration on the Articles list.
*   **Constraints**: No changes to the public API, no changes to the embeddable widget, no AI changes. Must remain minimal and stable.

## 3. Database & State Rules (Prisma)

No schema changes are required, but the logic surrounding the existing `ArticleStatus` enum and `publishedAt` field will be strictly enforced.

*   **DRAFT -> PUBLISHED**:
    *   Set `status` to `PUBLISHED`.
    *   Set `publishedAt` to `now()` (or preserve it if a previous publish date exists and preservation is desired; for this slice, we will set/update it to `now()`).
*   **PUBLISHED -> DRAFT**:
    *   Set `status` to `DRAFT`.
    *   Clear `publishedAt` (set to `null`).

## 4. Internal API Design

We will create an internal Next.js Server Action to handle the state transition securely and minimize client-side JavaScript.

### 4.1. Toggle Status Server Action
*   **Signature**: `toggleArticleStatus(articleId: string, newStatus: 'DRAFT' | 'PUBLISHED')`
*   **Logic**:
    1.  Validate input using Zod.
    2.  Verify the article exists.
    3.  If `newStatus` is `PUBLISHED`, perform a Prisma `update` setting `status: 'PUBLISHED'` and `publishedAt: new Date()`.
    4.  If `newStatus` is `DRAFT`, perform a Prisma `update` setting `status: 'DRAFT'` and `publishedAt: null`.
    5.  Call `revalidatePath` to refresh the UI and any cached API responses.

## 5. UI Behavior
*   **Location**: `/[siteId]/articles` (The Articles list page).
*   **Action**: A simple "Publish" or "Unpublish" toggle or button next to each article in the list.
*   **Feedback**: The UI should indicate the loading state while the Server Action executes, followed by reflecting the new status.

## 6. Validation Rules (Zod)

```typescript
import { z } from 'zod';

export const ToggleArticleStatusSchema = z.object({
  articleId: z.string().cuid("Invalid Article ID"),
  status: z.enum(['DRAFT', 'PUBLISHED']),
});
```

## 7. Acceptance Criteria
*   [ ] User can click a "Publish" button on a `DRAFT` article from the Articles page.
*   [ ] Publishing an article updates its database `status` to `PUBLISHED` and sets `publishedAt` to the current timestamp.
*   [ ] User can click an "Unpublish" button on a `PUBLISHED` article.
*   [ ] Unpublishing an article updates its database `status` to `DRAFT` and clears (`null`) the `publishedAt` timestamp.
*   [ ] The public API (from Slice 2) immediately reflects the status change (published articles appear, unpublished articles return 404).
*   [ ] The embeddable widget (from Slice 3) dynamically reflects the new published state based on the API without any code modifications.