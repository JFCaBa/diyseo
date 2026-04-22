# Slice 27 Architecture Plan: Public Blog Footer & Meta Links

## 1. Objective
Define the architecture for Slice 27, which introduces a unified, minimal footer across all public blog pages (`/blog/[siteId]` and `/blog/[siteId]/[slug]`). This footer consolidates technical discoverability links (RSS, Atom, Sitemap, robots.txt) into a consistent, unobtrusive location.

## 2. Scope & Constraints
*   **Included**: A new reusable footer UI component for the public blog layout. Addition of links pointing to the endpoints created in Slices 18 (RSS), 19 (Sitemap), 24 (robots.txt), and 25 (Atom).
*   **Excluded**: No changes to the actual XML/TXT generation logic, no public API changes, no embeddable widget changes, and no AI logic changes.
*   **Constraints**: Must remain visually minimal so as not to distract from the core article content or blog index.

## 3. UI Behavior & Placement Rules

### 3.1. Placement
*   **Location**: The very bottom of the page content, below the article list (on the index page) or below the article body (on the detail page).
*   **Layout Context**: Since both `/blog/[siteId]` and `/blog/[siteId]/[slug]` share a common path hierarchy, this component can ideally be integrated into a shared layout (e.g., `app/blog/[siteId]/layout.tsx`) to ensure consistency and prevent code duplication.

### 3.2. Visual Styling
*   **Appearance**: A simple, horizontal (or wrapping) list of links.
*   **Typography**: Muted text color (e.g., `text-gray-400` or `text-gray-500` in Tailwind), small font size (`text-sm` or `text-xs`), and subtle hover states (`hover:text-gray-900` or an underline).
*   **Separators**: Items should be separated by whitespace, bullets (`•`), or pipe characters (`|`).

## 4. Route Usage & Link Generation

The footer component requires the current `siteId` to generate the correct links.

*   **RSS Feed**: `/blog/[siteId]/rss.xml`
*   **Atom Feed**: `/blog/[siteId]/atom.xml`
*   **Sitemap**: `/blog/[siteId]/sitemap.xml`
*   **Robots**: `/blog/robots.txt` (Note: This is a global route, independent of the specific `siteId`, as defined in Slice 24).

## 5. Fallback Behavior

### 5.1. Missing `siteId` Context
*   If the footer component is somehow rendered in a context where `siteId` is undefined or unavailable (e.g., a generic error page within the blog route), it should gracefully handle this by:
    *   Hiding the site-specific links (RSS, Atom, Sitemap).
    *   Still displaying the global `robots.txt` link, as it requires no dynamic parameters.

## 6. Acceptance Criteria
*   [ ] A minimal footer is visible at the bottom of the `/blog/[siteId]` index page.
*   [ ] The same minimal footer is visible at the bottom of the `/blog/[siteId]/[slug]` article detail page.
*   [ ] The footer contains functional links to the site's specific RSS feed, Atom feed, and XML Sitemap.
*   [ ] The footer contains a functional link to the global `/blog/robots.txt` file.
*   [ ] The links use relative routing to ensure they work seamlessly regardless of the deployment environment.
*   [ ] The styling is unobtrusive (e.g., small, muted text) and does not conflict with the main content.
*   [ ] If `siteId` is missing, the component degrades gracefully without throwing a render error.
*   [ ] Existing endpoints and feeds remain entirely unaffected.