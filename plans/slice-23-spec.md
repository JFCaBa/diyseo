# Slice 23 Architecture Plan: Public Blog Homepage Metadata

## 1. Objective
Define the architecture for Slice 23, focusing on adding SEO metadata to the root `/blog` landing/chooser page introduced in Slice 22. This ensures proper indexing and sharing capabilities for the entry point of the multi-site blog system.

## 2. Scope & Constraints
*   **Included**: Next.js `generateMetadata` implementation for the `/blog` route, covering Title, Description, and Canonical URL. Handling metadata logic for the multi-site chooser and empty-state scenarios.
*   **Constraints**: No changes to the public API, embeddable widget, or AI generation logic. Must remain minimal, fast, and SEO-friendly.

## 3. Metadata Rules & Context Usage

The metadata generation will rely on the Next.js `generateMetadata` function. Since this route acts differently based on the number of existing `SiteProject`s (as per Slice 22), the metadata logic must account for these states.

### 3.1. Single-Site Redirect Case
If exactly one `SiteProject` exists, the page component executes a redirect to `/blog/[siteId]`. In Next.js, a server-side `redirect()` typically supersedes the metadata rendering of the origin page. However, for robustness and crawler behavior, the `generateMetadata` function should still provide a valid fallback.
*   *Behavior*: If 1 site exists, the metadata can conceptually return generic values, as search engine crawlers and social scrapers will follow the HTTP 307/302 redirect and parse the destination page's metadata directly.

### 3.2. Multi-Site Chooser Case (>1 Sites)
If multiple sites exist, the user sees the site chooser. The metadata should reflect the aggregate nature of the page.
*   **Title**: We will query the `Workspace` name (as this represents the overarching organization). Example: `{Workspace.name} Blogs` or simply `Our Blogs`.
*   **Description**: A generic but descriptive string, e.g., `Browse and discover the latest articles across all our hosted publications.`
*   **Canonical URL**: `${process.env.NEXT_PUBLIC_APP_URL}/blog`

### 3.3. Empty-State Case (0 Sites)
If no sites exist, the page renders an empty state message.
*   **Title**: `Blogs - Currently Unavailable`
*   **Description**: `There are currently no public blogs available on this platform.`
*   **Canonical URL**: `${process.env.NEXT_PUBLIC_APP_URL}/blog`

## 4. Implementation Design

```typescript
import { Metadata } from 'next';

// Inside app/blog/page.tsx
export async function generateMetadata(): Promise<Metadata> {
  const sitesCount = await prisma.siteProject.count();
  const workspace = await prisma.workspace.findFirst({ select: { name: true } }); 
  
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const canonicalUrl = `${baseUrl}/blog`;

  if (sitesCount === 0) {
    return {
      title: 'Blogs - Not Found',
      description: 'There are currently no public blogs available.',
      alternates: { canonical: canonicalUrl }
    };
  }

  // If sitesCount === 1, the redirect in the page component handles user routing.
  // Crawlers will follow the redirect to /blog/[siteId].
  
  return {
    title: `${workspace?.name || 'Platform'} Blogs`,
    description: 'Browse the latest articles across our hosted publications.',
    alternates: { canonical: canonicalUrl }
  };
}
```

## 5. Acceptance Criteria
*   [ ] The `/blog` route implements `generateMetadata` to dynamically output SEO tags.
*   [ ] When multiple sites exist, the `<title>` and `<meta name="description">` tags accurately describe a directory of blogs, incorporating the overarching `Workspace` name.
*   [ ] When zero sites exist, the metadata clearly reflects the empty/unavailable state.
*   [ ] The route includes a `<link rel="canonical">` tag pointing to the absolute `/blog` URL.
*   [ ] The logic accounts for the single-site redirect scenario, ensuring crawlers receive appropriate headers/redirects rather than incorrect static tags.
*   [ ] The public API and embeddable widget remain entirely unaffected.