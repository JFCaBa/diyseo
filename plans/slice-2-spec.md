# Slice 2 Architecture Plan: Article Model & Public API

## 1. Objective
Define the architecture for Slice 2, focusing on the core content engine. This includes the `Article` database model, its relationship to the existing `SiteProject`, and a stable, read-only public API to expose published content to external frontends.

## 2. Scope & Constraints
*   **Included**: Article model (DB), status management (Draft/Published), Seed data (2-3 articles), Public API routes (GET list, GET single by slug).
*   **Constraints**: No authentication, no pagination, no embeddable widget yet. Minimalist and stable design.

## 3. Database Schema Updates (Prisma)

### 3.1. New Enum: `ArticleStatus`
```prisma
enum ArticleStatus {
  DRAFT
  PUBLISHED
}
```

### 3.2. New Model: `Article`
```prisma
model Article {
  id            String        @id @default(cuid())
  siteProjectId String
  title         String
  slug          String
  content       String        @db.Text // Store Markdown or raw HTML for V1
  status        ArticleStatus @default(DRAFT)
  publishedAt   DateTime?
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  siteProject   SiteProject   @relation(fields: [siteProjectId], references: [id], onDelete: Cascade)

  @@unique([siteProjectId, slug]) // Ensure slugs are unique per site
  @@index([siteProjectId, status]) // Optimize querying published articles for a site
}
```

### 3.3. Updated Model: `SiteProject`
```prisma
// This is an update to the existing SiteProject model defined in Slice 1
model SiteProject {
  id          String   @id @default(cuid())
  workspaceId String
  name        String
  domain      String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  workspace    Workspace     @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  brandProfile BrandProfile?
  articles     Article[]     // New relationship for Slice 2
}
```

## 4. Public API Routes
These routes expose content for external consumption. They must be fast, stable, and strictly read-only.

### 4.1. Get All Published Articles
*   **Endpoint**: `GET /api/public/sites/:siteId/articles`
*   **Description**: Retrieves a list of all *published* articles for a specific site.
*   **Behavior**: Returns an array of articles, omitting the full `content` field to keep the payload small. Orders by `publishedAt` descending.
*   **Response Schema**:
    ```typescript
    type ArticlesListResponse = {
      id: string;
      title: string;
      slug: string;
      publishedAt: string; // ISO date string
    }[];
    ```

### 4.2. Get Single Article by Slug
*   **Endpoint**: `GET /api/public/sites/:siteId/articles/:slug`
*   **Description**: Retrieves the full details of a single *published* article based on its unique slug within the site context.
*   **Behavior**: Returns the full article including `content`. If the article is a `DRAFT` or does not exist, returns a 404 Not Found.
*   **Response Schema**:
    ```typescript
    type ArticleDetailResponse = {
      id: string;
      title: string;
      slug: string;
      content: string;
      publishedAt: string; // ISO date string
    };
    ```

## 5. Slug & Status Rules
*   **Status Model**: 
    *   `DRAFT`: The initial state. Not visible on the public API.
    *   `PUBLISHED`: Visible on the public API. The `publishedAt` timestamp must be set when transitioning to this state.
*   **Slug Rules**:
    *   Must be unique within the context of a single `SiteProject`.
    *   Format: URL-safe, lowercase, alphanumeric, separated by hyphens (e.g., `my-first-post`).
    *   Validation Regex: `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`

## 6. Validation Rules (Zod)

```typescript
import { z } from 'zod';

export const SlugSchema = z.string()
  .min(3, "Slug must be at least 3 characters")
  .max(100, "Slug cannot exceed 100 characters")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must contain only lowercase letters, numbers, and hyphens");

export const CreateArticleSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  slug: SlugSchema,
  content: z.string().min(1, "Content is required"),
  status: z.enum(['DRAFT', 'PUBLISHED']).default('DRAFT'),
});
```

## 7. Seed Data (`prisma/seed.ts` Updates)
The seed script will be updated to attach articles to the "Demo Site" created in Slice 1.

1.  **Article 1**: "Welcome to our Demo Site"
    *   Slug: `welcome-demo`
    *   Status: `PUBLISHED`
    *   Content: "This is the first published article on the platform."
2.  **Article 2**: "The Future of Self-Hosted SEO"
    *   Slug: `future-seo`
    *   Status: `PUBLISHED`
    *   Content: "An exploration of owning your own data and content distribution."
3.  **Article 3**: "Draft: Upcoming Features"
    *   Slug: `upcoming-features-draft`
    *   Status: `DRAFT`
    *   Content: "This content is being worked on and should not be visible publicly."

## 8. Acceptance Criteria
*   [ ] The database schema successfully applies the `Article` model and `ArticleStatus` enum.
*   [ ] A unique constraint enforces that two articles on the same `SiteProject` cannot share a slug.
*   [ ] Running `npx prisma db seed` populates the database with 2 published articles and 1 draft article linked to the demo site.
*   [ ] `GET /api/public/sites/:siteId/articles` returns only the 2 published seed articles (omitting the `content` field).
*   [ ] `GET /api/public/sites/:siteId/articles/welcome-demo` returns the full details of the published article, including content.
*   [ ] `GET /api/public/sites/:siteId/articles/upcoming-features-draft` returns a 404 error because the article is a draft.