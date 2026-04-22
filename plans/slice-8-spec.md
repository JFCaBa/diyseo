# Slice 8 Architecture Plan: Content Calendar

## 1. Objective
Define the architecture for Slice 8, introducing a visual Content Calendar. This feature provides a month-view grid allowing users to see when articles are scheduled or published, change their publication dates, and quickly create new articles for specific dates.

## 2. Scope & Constraints
*   **Included**: Month-view calendar UI, displaying articles based on `publishedAt`, updating an article's `publishedAt` date, and a shortcut to create an article with a pre-filled date.
*   **Constraints**: No new database models required (reuses `Article.publishedAt`). No changes to the public API, embeddable widget, or AI logic. Must remain minimal and stable.

## 3. Database Usage
The calendar entirely relies on the existing `Article` model.
*   **Key Field**: `publishedAt` (DateTime).
*   **Querying**: Fetching articles where `siteProjectId` matches and `publishedAt` falls within the currently viewed month (start and end boundaries).
*   **Status Implication**: The calendar will display both `DRAFT` and `PUBLISHED` articles, differentiated visually (e.g., solid color for published, outlined for drafts), provided they have a `publishedAt` date assigned (acting as a "scheduled" date for drafts).

## 4. Internal API & Server Actions

We will introduce a specific Next.js Server Action to handle date re-assignments from the calendar interface.

### 4.1. `updateArticleDate(articleId: string, newDate: Date | null)`
*   **Logic**:
    1.  Validate inputs using Zod.
    2.  Verify the article exists and belongs to the active `siteId`.
    3.  Update the `publishedAt` field for the article in Prisma.
    4.  Call `revalidatePath` for `/[siteId]/calendar` and `/[siteId]/articles` to refresh the UI immediately.

*Note: For creating an article from a date, the existing article creation flow (Slice 4 or manual) will be reused, simply passing the selected date as an initial value.*

## 5. UI Behavior & Interactions

### 5.1. Calendar View (`/[siteId]/calendar`)
*   **Grid Layout**: A standard 7-column (Sun-Sat or Mon-Sun) grid displaying the days of the current month. Include "Prev" and "Next" month navigation controls.
*   **Article Placement**: Articles fetched from the database are placed in the cell corresponding to the day portion of their `publishedAt` date.
*   **Visual Distinction**: Differentiate between `PUBLISHED` (live) and `DRAFT` (scheduled/planned) articles using CSS classes (e.g., different background colors or borders).

### 5.2. Interaction Flow
*   **Clicking an Empty Date Cell**: Opens a modal or redirects to a "New Article" view with the `publishedAt` date pre-populated to the clicked date.
*   **Clicking an Existing Article**: Opens a quick-edit popover or redirects to the manual editor (Slice 7) to edit the article details.
*   **Changing Dates**: For V1, a simple "Change Date" button within the article's popover/editor, or implementing basic HTML5 Drag-and-Drop to move an article card from one date cell to another (triggering `updateArticleDate`).

## 6. Validation Rules (Zod)

```typescript
import { z } from 'zod';

export const UpdateArticleDateSchema = z.object({
  articleId: z.string().cuid("Invalid Article ID"),
  newDate: z.string().datetime({ offset: true }).nullable(), // Accepts ISO strings or null to unschedule
});
```

## 7. Acceptance Criteria
*   [ ] The `/[siteId]/calendar` route displays a monthly grid view.
*   [ ] The calendar fetches and accurately places articles based on their `publishedAt` date.
*   [ ] Drafts and Published articles are visually distinct on the calendar.
*   [ ] Clicking an empty date cell allows the user to initiate the creation of a new article for that date.
*   [ ] Users can change the `publishedAt` date of an existing article directly from the calendar interface (via edit form, popover, or drag-and-drop).
*   [ ] Updating a date triggers a Server Action that correctly persists the new `publishedAt` timestamp to the database and revalidates the view.
*   [ ] The public API continues to behave normally (only exposing `PUBLISHED` status articles, regardless of their past/future `publishedAt` dates, or depending on how Slice 5 strictly implemented it).