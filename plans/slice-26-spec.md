# Slice 26 Architecture Plan: Public Blog Feed Discoverability Polish

## 1. Objective
Define the architecture for Slice 26, which focuses on enhancing the discoverability of the Atom feed introduced in Slice 25. This slice polishes the public blog index page by adding Atom auto-discovery metadata and a visible link, complementing the existing RSS feed support without disrupting it.

## 2. Scope & Constraints
*   **Included**: Adding a visible UI link on the blog index pointing to the Atom feed endpoint. Injecting an auto-discovery `<link>` tag for the Atom feed into the `<head>` of the blog index page.
*   **Constraints**: The existing RSS route, metadata, and visible links must remain entirely unchanged. No changes to the public API, embeddable widget, or AI generation logic. Must remain minimal, stable, and rely purely on standard HTML/Next.js features.

## 3. Metadata Rules & Auto-Discovery

### 3.1. Blog Index Page (`/blog/[siteId]`)
*   **Auto-Discovery (Head)**: Utilize Next.js Metadata to inject an additional `alternate` link tag into the document `<head>` alongside the existing RSS tag. This allows modern feed readers to discover and offer the Atom format automatically.
    ```html
    <!-- Existing RSS Link (from Slice 20) -->
    <link rel="alternate" type="application/rss+xml" title="RSS Feed" href="/blog/[siteId]/rss.xml" />
    
    <!-- New Atom Link -->
    <link rel="alternate" type="application/atom+xml" title="Atom Feed" href="/blog/[siteId]/atom.xml" />
    ```

## 4. UI Behavior

### 4.1. Visible Feed Links
*   **Location**: The same meta-navigation or footer section on the `/blog/[siteId]` page where the RSS and Sitemap links were added in Slice 20.
*   **Addition**: Add a new `<a>` tag pointing to the Atom feed.
    *   **Text/Icon**: "Atom Feed" (or a standard feed icon labeled "Atom").
    *   **Target**: `/blog/[siteId]/atom.xml`.
*   Ensure the layout gracefully accommodates the new link alongside the existing "RSS Feed" and "Sitemap" links (e.g., in a small horizontal list or flex container).

## 5. Fallback Behavior

### 5.1. Handling Missing Application URLs
If the `NEXT_PUBLIC_APP_URL` environment variable is not defined or is temporarily unavailable during rendering:
*   **Metadata**: The `generateMetadata` function should safely fall back to generating relative URLs (e.g., `/blog/[siteId]/atom.xml`) for the `alternate` link tags, or omit the absolute domain portion, ensuring the page still renders without throwing a server error.
*   **UI Links**: The visible `<a>` tags in the footer should naturally use relative root-based paths (e.g., `href="/blog/[siteId]/atom.xml"`), which will work seamlessly regardless of the environment variable's presence.

## 6. Acceptance Criteria
*   [ ] The blog index page (`/blog/[siteId]`) displays a clearly visible link to the Atom feed, positioned alongside the existing RSS and Sitemap links.
*   [ ] The blog index page includes a new `<link rel="alternate" type="application/atom+xml">` tag in its `<head>` for auto-discovery.
*   [ ] The existing RSS `<link rel="alternate">` tag and visible UI link remain present and functional.
*   [ ] Clicking the visible Atom link correctly loads the XML endpoint defined in Slice 25.
*   [ ] If `NEXT_PUBLIC_APP_URL` is missing, the page renders successfully using relative paths for the feed links where applicable.
*   [ ] The public API and embeddable widget remain entirely unaffected.