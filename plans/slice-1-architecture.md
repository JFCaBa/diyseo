# Slice 1 Architecture Plan: Self-Hosted SEO Platform

## 1. Objective
Define the foundational architecture (Slice 1) for an open-source, self-hosted Soro-like SEO platform. This slice focuses on the core App Shell, multi-site management, and the Brand DNA editor, establishing the groundwork for future features.

## 2. Scope & Constraints
*   **Stack**: Next.js (App Router), Prisma, PostgreSQL, Tailwind CSS.
*   **Constraints**: Single-user (no authentication), no AI integrations, no web crawling mechanisms.

## 3. Route Map
Using Next.js App Router conventions:

*   `/` -> Redirects to the first available `SiteProject` or a setup page if none exist.
*   `/[siteId]/` -> **Home/Dashboard**: High-level overview placeholder.
*   `/[siteId]/brand-dna` -> **Brand DNA**: Editor for brand voice and structured identity fields.
*   `/[siteId]/calendar` -> **Calendar**: Content calendar UI placeholder.
*   `/[siteId]/articles` -> **Articles**: Article management UI placeholder.
*   `/[siteId]/analytics` -> **Analytics**: Traffic/performance placeholder.
*   `/[siteId]/keywords` -> **Keywords**: Keyword tracking placeholder.
*   `/settings` -> **Settings**: Global workspace settings and SiteProject management.

## 4. UI Structure & Components

### 4.1. Layouts
*   **RootLayout**: Applies global Tailwind styles, defines HTML structure.
*   **AppShellLayout**: Wraps all `/[siteId]/*` routes. Provides the persistent layout.
    *   **Sidebar**: Contains main navigation links.
    *   **Topbar**: Contains the global `SiteSelector`.

### 4.2. Core Components
*   `SiteSelector`: Dropdown component to switch between `SiteProject` entities. Updates the `siteId` route parameter.
*   `SidebarNav`: Navigation links aware of the current `siteId` to maintain routing context.
*   `PageHeader`: Consistent title and action button area for pages.
*   `BrandDNAForm`: Client-side form for editing the BrandProfile. Uses dynamic fields for structured inputs.
*   `EmptyState`: Reusable component for empty lists or missing configurations.

## 5. Database Schema (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Workspace {
  id        String   @id @default(cuid())
  name      String   @default("My Workspace")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  sites     SiteProject[]
}

model SiteProject {
  id          String   @id @default(cuid())
  workspaceId String
  name        String
  domain      String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  brandProfile BrandProfile?
}

model BrandProfile {
  id               String   @id @default(cuid())
  siteProjectId    String   @unique
  targetAudience   String?  // JSON or text, depending on UI needs. Text for V1.
  toneOfVoice      String?  
  coreValues       String?  // Could be comma-separated or JSON array.
  missionStatement String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  siteProject      SiteProject @relation(fields: [siteProjectId], references: [id], onDelete: Cascade)
}
```

## 6. API & Server Actions
To minimize client-side data fetching and maintain strong typing, we will utilize Next.js Server Actions for mutations.

*   `createSite(data: CreateSiteInput)`: Creates a new `SiteProject` and initializes an empty `BrandProfile`.
*   `updateBrandDNA(siteId: string, data: BrandDNAInput)`: Updates the `BrandProfile` associated with a specific site.
*   **Data Fetching**: Handled directly in Server Components (e.g., `await prisma.siteProject.findMany()`).

## 7. Validation Rules (Zod)

```typescript
import { z } from 'zod';

export const CreateSiteSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(50),
  domain: z.string().url("Must be a valid URL (e.g., https://example.com)"),
});

export const UpdateBrandDNASchema = z.object({
  targetAudience: z.string().max(1000).optional(),
  toneOfVoice: z.string().max(500).optional(),
  coreValues: z.string().max(500).optional(),
  missionStatement: z.string().max(1000).optional(),
});
```

## 8. Seed Data
A script (`prisma/seed.ts`) to ensure the application is usable immediately.

1.  Checks if a `Workspace` exists. If not, creates "Default Workspace".
2.  Checks if any `SiteProject` exists. If not, creates "Demo Site" (e.g., `https://demo.com`) linked to the default workspace.
3.  Creates an empty `BrandProfile` linked to the "Demo Site".

## 9. Acceptance Criteria
*   [ ] User can run `npm run dev` and immediately access the application without authentication.
*   [ ] A default site is selected on initial load, or the user is prompted to create one if the database is empty.
*   [ ] The App Shell sidebar is visible on all `/[siteId]/*` routes.
*   [ ] User can navigate between Home, Brand DNA, Calendar, Articles, Analytics, Keywords, and Settings via the sidebar.
*   [ ] User can switch contexts using the multi-site selector in the Topbar.
*   [ ] User can view and update fields in the Brand DNA editor (Target Audience, Tone of Voice, Core Values, Mission Statement).
*   [ ] Brand DNA changes are persisted to the database and revalidated on the page.
*   [ ] Validation rules prevent submitting invalid URLs for new sites or excessively long text for Brand DNA fields.