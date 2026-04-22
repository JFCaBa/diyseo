# Slice 22 Architecture Plan: Public Blog Home & Redirection

## 1. Objective
Define the architecture for Slice 22, focusing on the root `/blog` route. This route serves as the entry point for the public-facing blog system, providing intelligent redirection for single-site instances and a minimal navigation portal for multi-site deployments.

## 2. Scope & Constraints
*   **Included**: A new server-rendered route (`/blog`), database query to count/fetch existing `SiteProject` records, redirection logic, and a minimal multi-site chooser UI.
*   **Constraints**: No changes to the public API, embeddable widget, or AI generation logic. Must remain minimal, fast, and stable.

## 3. Route Behavior & DB Usage

### 3.1. Route Definition
*   **Path**: `app/blog/page.tsx` (using Next.js App Router).
*   **Type**: Server Component.

### 3.2. Database Query & Logic Flow
The page will fetch the list of existing `SiteProject`s directly from Prisma during the server render phase to determine the correct behavior.

```typescript
// Fetch all available sites
const sites = await prisma.siteProject.findMany({
  select: { id: true, name: true, domain: true },
  orderBy: { createdAt: 'asc' }
});

// Logic Flow:
// 1. Zero Sites: Show empty state
if (sites.length === 0) {
  return renderEmptyState(); 
}

// 2. Single Site: Auto-redirect
if (sites.length === 1) {
  redirect(`/blog/${sites[0].id}`);
}

// 3. Multiple Sites: Render Chooser
return renderSiteChooser(sites);
```

## 4. UI Behavior & Multi-Site Handling

### 4.1. Empty-State Behavior (0 Sites)
*   If no sites exist in the database, render a simple message indicating that no public blogs are currently available. 
*   *Optional Context*: Since this is a public route, do not expose internal creation links unless the user is authenticated (which is outside the scope of this single-user, no-auth constraint for public views; a simple text message suffices).

### 4.2. Auto-Redirect (1 Site)
*   The vast majority of self-hosted instances will likely only have one site. The route immediately executes a 307 (Temporary) or 302 redirect to `/blog/[siteId]` using Next.js's `redirect()` function. This ensures a seamless user experience.

### 4.3. Multi-Site Chooser (>1 Sites)
*   If the user manages multiple sites, render a minimal landing page.
*   **Layout**: A clean, centered list or grid of cards.
*   **Item Content**: Each item displays the `SiteProject.name` and its associated `domain`.
*   **Action**: Clicking an item navigates the user to that specific site's public blog index (`/blog/[siteId]`).

## 5. Acceptance Criteria
*   [ ] A user visiting `/blog` when exactly one `SiteProject` exists in the database is automatically redirected to `/blog/[siteId]`.
*   [ ] A user visiting `/blog` when multiple `SiteProject` records exist is presented with a list of available blogs to choose from.
*   [ ] The multi-site chooser accurately links to the respective `/blog/[siteId]` routes.
*   [ ] A user visiting `/blog` when no `SiteProject` records exist sees a friendly empty state message.
*   [ ] The routing logic is handled securely and quickly on the server.
*   [ ] The existing `/api/public/...` endpoints and the embeddable widget remain entirely unaffected.