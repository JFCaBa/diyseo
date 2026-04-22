# Slice 24 Architecture Plan: Public Blog robots.txt

## 1. Objective
Define the architecture for Slice 24, introducing a dynamically generated `robots.txt` endpoint for the public-facing blog section. This file instructs search engine crawlers on which pages to index and provides direct links to the XML sitemaps for all existing public blogs.

## 2. Scope & Constraints
*   **Included**: A new Next.js Route Handler (`/blog/robots.txt`), server-side generation of standard `robots.txt` plain text, and querying the database to list sitemap URLs for all active sites.
*   **Included Directives**: `Allow` rules for `/blog` and `/blog/*`, and `Sitemap` declarations.
*   **Constraints**: No changes to the existing public API, embeddable widget, or AI generation logic. Keep it minimal, fast, and fully compliant with the robots exclusion standard.

## 3. Route Behavior & DB Usage

### 3.1. Route Definition
*   **Path**: `app/blog/robots.txt/route.ts` (Next.js App Router API Route).
*   **Type**: GET Request Handler.
*   **Response**: `Content-Type: text/plain`.

### 3.2. Database Query
The route needs to query the database for all existing `SiteProject` IDs to dynamically generate the list of `Sitemap` URLs.

```typescript
// Fetch all site IDs
const sites = await prisma.siteProject.findMany({
  select: { id: true }
});
```

## 4. Text Output Rules & Sitemap References

The output must be a valid plain text string following the `robots.txt` standard. Absolute URLs for the sitemaps must be constructed using the `NEXT_PUBLIC_APP_URL` environment variable.

### 4.1. Output Generation Logic
1.  **User-Agent Directive**: Apply rules to all crawlers (`User-agent: *`).
2.  **Allow Directives**: Explicitly allow crawling of the root `/blog` and all sub-paths `/blog/*`.
3.  **Sitemap Declarations**: Loop through the fetched `SiteProject` IDs and output a `Sitemap:` directive pointing to the respective site's sitemap (defined in Slice 19).

```text
# Example Output
User-agent: *
Allow: /blog
Allow: /blog/*

Sitemap: https://yourdomain.com/blog/siteId1/sitemap.xml
Sitemap: https://yourdomain.com/blog/siteId2/sitemap.xml
```

## 5. Empty-State Behavior
If there are no `SiteProject` records in the database, the route must still return a valid `robots.txt` file. In this empty state, it will provide the standard `User-agent` and `Allow` directives but omit any `Sitemap:` declarations.

```text
# Empty State Output
User-agent: *
Allow: /blog
Allow: /blog/*
```

## 6. Validation Rules & Configuration
*   Ensure the `NEXT_PUBLIC_APP_URL` environment variable is defined and does not include a trailing slash to prevent malformed sitemap URLs.
*   The response must be strictly formatted with standard newline characters (`\n`).

## 7. Acceptance Criteria
*   [ ] A GET request to `/blog/robots.txt` returns a valid plain text response (`Content-Type: text/plain`).
*   [ ] The file includes `User-agent: *` and `Allow` directives for the blog routes.
*   [ ] The file dynamically includes a `Sitemap:` directive for every existing `SiteProject` in the database.
*   [ ] All `Sitemap:` URLs are absolute, utilizing the application's base URL environment variable.
*   [ ] If no sites exist in the database, the file still renders the base directives without breaking or throwing errors.
*   [ ] The existing `/api/public/...` endpoints, blog pages, and embeddable widget remain entirely unaffected.