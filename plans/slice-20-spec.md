# Slice 20 Architecture Plan: Public Blog Discoverability

## 1. Objective
Define the architecture for Slice 20, which focuses on improving the discoverability and internal navigation of the public-facing blog pages. This connects the blog index, article detail, RSS feed, and Sitemap into a cohesive, easily navigable structure.

## 2. Scope & Constraints
*   **Included**: Adding visible UI links on the blog index pointing to the RSS and Sitemap endpoints. Adding a "Back to Blog" navigation link on the article detail page. Injecting auto-discovery `<link>` tags for RSS.
*   **Constraints**: No changes to the public API, embeddable widget, or AI generation logic. Must remain minimal, stable, and rely purely on standard HTML/Next.js features.

## 3. UI Behavior & Route Usage

### 3.1. Blog Index Page (`/blog/[siteId]`)
*   **Visible Links**: Add a minimal footer or a meta-navigation section (e.g., just below the header or at the bottom of the article list).
    *   **RSS Link**: An `<a>` tag pointing to `/blog/[siteId]/rss.xml`.
    *   **Sitemap Link**: An `<a>` tag pointing to `/blog/[siteId]/sitemap.xml`.
*   **Auto-Discovery (Head)**: Utilize Next.js Metadata to inject an alternate link tag into the document `<head>`, allowing RSS readers and browsers to automatically discover the feed.
    ```html
    <link rel="alternate" type="application/rss+xml" title="RSS Feed" href="/blog/[siteId]/rss.xml" />
    ```

### 3.2. Article Detail Page (`/blog/[siteId]/[slug]`)
*   **Navigation Link**: Add a small, unobtrusive link near the top of the page (e.g., above the article title or in a minimal breadcrumb structure).
    *   **Text**: "← Back to Blog" (or similar).
    *   **Target**: `/blog/[siteId]`.
*   This ensures users who land directly on an article (e.g., via search or social media) can easily discover the rest of the site's content.

## 4. Acceptance Criteria
*   [ ] The blog index page (`/blog/[siteId]`) displays clearly visible links to the RSS feed and Sitemap XML.
*   [ ] The blog index page includes a `<link rel="alternate">` tag in its `<head>` pointing to the RSS feed for auto-discovery.
*   [ ] The article detail page (`/blog/[siteId]/[slug]`) includes a functional "Back" link pointing to the blog index.
*   [ ] Clicking the RSS or Sitemap links correctly loads the XML endpoints defined in Slices 18 and 19.
*   [ ] The public API and embeddable widget remain entirely unaffected.