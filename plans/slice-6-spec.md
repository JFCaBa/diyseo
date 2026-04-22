# Slice 6 Architecture Plan: Keyword Management

## 1. Objective
Define the architecture for Slice 6, which introduces a minimal Keyword management system. This allows users to create keywords, list them, and assign them to articles. The system will track whether a keyword is `NEW` or `USED`.

## 2. Scope & Constraints
*   **Included**: Keyword CRUD (Create, List), assigning keywords to articles, tracking keyword status (`NEW` / `USED`).
*   **Constraints**: No changes to the public API from Slice 2. No changes to the widget from Slice 3. No changes to the AI generation logic from Slice 4. Must be minimal and stable.

## 3. Database Schema Updates (Prisma)

We need to create a new `Keyword` model and establish relationships with `SiteProject` and `Article`.

### 3.1. New Enum: `KeywordStatus`
```prisma
enum KeywordStatus {
  NEW
  USED
}
```

### 3.2. New Model: `Keyword`
```prisma
model Keyword {
  id            String        @id @default(cuid())
  siteProjectId String
  term          String
  status        KeywordStatus @default(NEW)
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  siteProject   SiteProject   @relation(fields: [siteProjectId], references: [id], onDelete: Cascade)
  articles      Article[]     // A keyword can be assigned to multiple articles

  @@unique([siteProjectId, term]) // Ensure keywords are unique per site
}
```

### 3.3. Updated Models: `SiteProject` and `Article`
```prisma
// In SiteProject
model SiteProject {
  // ... existing fields
  keywords Keyword[]
}

// In Article
model Article {
  // ... existing fields
  keywordId String?
  keyword   Keyword? @relation(fields: [keywordId], references: [id], onDelete: SetNull)
}
```

## 4. Internal API & Server Actions

We will use Next.js Server Actions to handle mutations securely.

### 4.1. `createKeyword(siteId: string, term: string)`
*   Validates the term.
*   Checks for uniqueness within the site.
*   Creates a new `Keyword` with `status: 'NEW'`.

### 4.2. `assignKeywordToArticle(articleId: string, keywordId: string | null)`
*   Updates the `Article` to set the `keywordId`.
*   If a `keywordId` is provided, updates the assigned `Keyword` to `status: 'USED'`.
*   (Optional but recommended) Checks if the previously assigned keyword (if any) is still used by other articles; if not, reverts its status to `NEW`. For simplicity in V1, setting to `USED` is sufficient, or a cron/trigger can clean it up. We will implement simple toggle: if assigned, mark `USED`.

## 5. UI Behavior

### 5.1. Keywords Page (`/[siteId]/keywords`)
*   **Create Form**: A simple input field and "Add Keyword" button.
*   **List View**: A table or list displaying the `term` and `status` (`NEW` / `USED`).

### 5.2. Articles Page / Editor (`/[siteId]/articles`)
*   **Assignment**: When creating or editing an article (or triggering AI generation), provide a dropdown or selection mechanism to choose an existing keyword from the site's keywords.
*   **Display**: Show the assigned keyword tag next to the article in the article list.

## 6. Validation Rules (Zod)

```typescript
import { z } from 'zod';

export const CreateKeywordSchema = z.object({
  term: z.string().min(1, "Keyword term is required").max(100),
});

export const AssignKeywordSchema = z.object({
  articleId: z.string().cuid(),
  keywordId: z.string().cuid().nullable(),
});
```

## 7. Acceptance Criteria
*   [ ] `Keyword` model is added to the Prisma schema with a unique constraint on `[siteProjectId, term]`.
*   [ ] The `Article` model has an optional relationship to a `Keyword`.
*   [ ] User can add a new keyword on the Keywords page; it defaults to `NEW` status.
*   [ ] User can view a list of all keywords for the current site.
*   [ ] User can assign an existing keyword to an article.
*   [ ] When a keyword is assigned to an article, its status automatically updates to `USED`.
*   [ ] The public API remains unaffected by these changes.