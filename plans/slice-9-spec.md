# Slice 9 Architecture Plan: Site Onboarding Flow

## 1. Objective
Define the architecture for Slice 9, which introduces a dedicated onboarding flow for adding new websites (SiteProjects) to the platform. This flow allows users to bootstrap a new site with its core identity and instantly switches their context to the new dashboard.

## 2. Scope & Constraints
*   **Included**: A new "Add Website" UI flow, creating a `SiteProject` along with an initial `BrandProfile`, capturing basic configuration (name, domain, language), and automatic context switching.
*   **Constraints**: No changes to the public API, embeddable widget, or AI generation logic. Must be minimal and stable.

## 3. Database Usage & Schema Updates (Prisma)

We need to add a `language` field to capture the content language during onboarding. We will add this to the `SiteProject` or `BrandProfile` model. Let's add it to `BrandProfile` to keep brand-specific settings grouped.

### 3.1. Updated Model: `BrandProfile`
```prisma
model BrandProfile {
  id               String   @id @default(cuid())
  siteProjectId    String   @unique
  language         String   @default("en") // New field added
  targetAudience   String?  
  toneOfVoice      String?  
  coreValues       String?  
  missionStatement String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  siteProject      SiteProject @relation(fields: [siteProjectId], references: [id], onDelete: Cascade)
}
```

## 4. UI Flow & Multi-Site Selector Behavior

### 4.1. Onboarding UI (`/new-site` or modal)
*   **Entry Point**: An "Add Site" button located within the global multi-site selector (Topbar) and on the `/settings` page.
*   **Form Fields**:
    *   **Site Name**: e.g., "My Awesome Blog"
    *   **Domain**: e.g., "https://blog.myawesome.com"
    *   **Content Language**: A simple text input or select dropdown (e.g., "English", "Spanish", "fr", "en-US").
*   **Action**: "Create Site" button.

### 4.2. Post-Creation Flow & Context Switching
*   Upon successful creation, the user is immediately **redirected** to `/[newSiteId]/` (the dashboard for the newly created site).
*   The global **Multi-Site Selector** component in the Topbar must re-fetch or optimistically update to include the new site in its dropdown list, and it should display the newly created site as the active selection.

## 5. Internal API & Server Actions

We will introduce a Server Action to handle the transactional creation of both the `SiteProject` and its associated `BrandProfile`.

### 5.1. `createSiteProject(data: CreateSiteInput)`
*   **Logic**:
    1.  Validate inputs using Zod.
    2.  Retrieve the default `workspaceId` (since this is a single-user system, we fetch the first/only workspace).
    3.  Execute a Prisma transaction to:
        *   Create the `SiteProject` record.
        *   Create the associated `BrandProfile` record, seeding it with the provided `language` (and keeping other fields empty/null).
    4.  Call `revalidatePath` to clear cached layouts (e.g., the Topbar's site list).
    5.  Return the new `siteId` to the client.
    6.  Client performs a Next.js `redirect(to: `/${newSiteId}`)`.

## 6. Validation Rules (Zod)

```typescript
import { z } from 'zod';

export const CreateSiteProjectSchema = z.object({
  name: z.string().min(2, "Site name must be at least 2 characters").max(100),
  domain: z.string().url("Must be a valid URL (e.g., https://example.com)"),
  language: z.string().min(2, "Language code is required").max(50).default("en"),
});
```

## 7. Acceptance Criteria
*   [ ] The database schema is updated to include a `language` field (e.g., on `BrandProfile`).
*   [ ] A user can access an "Add Site" form from the multi-site selector or settings page.
*   [ ] The form successfully captures the Site Name, Domain, and Language.
*   [ ] Submitting the form creates both a `SiteProject` and an associated `BrandProfile` via a Server Action transaction.
*   [ ] The form enforces validation rules (e.g., requiring a valid URL for the domain).
*   [ ] Upon successful creation, the user is automatically redirected to the new site's dashboard (`/[newSiteId]/`).
*   [ ] The multi-site selector accurately reflects the newly created site and marks it as active.