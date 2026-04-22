# Slice 17 Architecture Plan: SEO Metadata for Public Blog

## 1. Objective
Define the architecture for Slice 17, focusing on implementing comprehensive SEO metadata for the public-facing blog pages introduced in Slices 15 and 16. This ensures both the blog index and individual article pages are properly indexed by search engines and generate rich previews when shared on social media.

## 2. Scope & Constraints
*   **Included**: Next.js `generateMetadata` implementation for the Blog Index (`/blog/[siteId]`) and Article Detail (`/blog/[siteId]/[slug]`) routes.
*   **Metadata Targeted**: `<title>`, `<meta name="description">`, `<link rel="canonical">`, and basic Open Graph (`og:title`, `og:description`, `og:url`, `og:type`) tags.
*   **Constraints**: Must reuse existing database fields (`seoTitle`, `seoDescription`, `title`, `excerpt`, `SiteProject.name`). No changes to the public API, embeddable widget, or AI generation logic. Must rely on a configurable base URL for canonicals.

## 3. Database Usage & Fallback Behavior

The metadata generation will rely on data fetched during the server-side rendering of the respective pages.

### 3.1. Article Detail Page (`/blog/[siteId]/[slug]`)
*   **Title**:
    *   *Primary*: `Article.seoTitle`
    *   *Fallback*: `Article.title`
*   **Description**:
    *   *Primary*: `Article.seoDescription`
    *   *Fallback*: `Article.excerpt` (or truncated `Article.content` if excerpt is unexpectedly empty)
*   **Open Graph Type**: `article`
*   **Open Graph Published Time**: `Article.publishedAt` (ISO string)

### 3.2. Blog Index Page (`/blog/[siteId]`)
*   **Title**: `{SiteProject.name} Blog`
*   **Description**: `Read the latest articles and updates from {SiteProject.name}.` (Since we don't have a dedicated site description field yet, a generic but relevant template is used).
*   **Open Graph Type**: `website`

## 4. Route Integration Points

We will utilize the Next.js `generateMetadata` function exported from the `page.tsx` files.

### 4.1. Global Configuration
To generate absolute canonical and Open Graph URLs, the application requires an environment variable (e.g., `NEXT_PUBLIC_APP_URL` or `BASE_URL`).
*   Example Canonical: `${process.env.NEXT_PUBLIC_APP_URL}/blog/${siteId}/${slug}`

### 4.2. Implementation Strategy (Next.js `Metadata` Object)
```typescript
import { Metadata } from 'next';

// Inside app/blog/[siteId]/[slug]/page.tsx
export async function generateMetadata({ params }): Promise<Metadata> {
  const article = await getArticleBySlug(params.siteId, params.slug);
  if (!article) return {};

  const title = article.seoTitle || article.title;
  const description = article.seoDescription || article.excerpt;
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/blog/${params.siteId}/${params.slug}`;

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      type: 'article',
      publishedTime: article.publishedAt?.toISOString(),
      // siteName: article.siteProject.name
    },
  };
}
```

## 5. Validation Rules & Constraints
*   The `generateMetadata` function must safely handle cases where the database query returns `null` (e.g., returning an empty metadata object or relying on a generic layout fallback).
*   Ensure the `NEXT_PUBLIC_APP_URL` is defined and does not include a trailing slash to prevent malformed URLs.

## 6. Acceptance Criteria
*   [ ] The `/blog/[siteId]` route includes `<title>`, `<meta name="description">`, and `<link rel="canonical">` tags correctly populated with site data.
*   [ ] The `/blog/[siteId]` route includes `og:title`, `og:description`, `og:url`, and `og:type="website"` tags.
*   [ ] The `/blog/[siteId]/[slug]` route prioritizes `seoTitle` and `seoDescription` for its metadata tags.
*   [ ] The `/blog/[siteId]/[slug]` route correctly falls back to `title` and `excerpt` if the SEO-specific fields are missing or empty.
*   [ ] The `/blog/[siteId]/[slug]` route includes `og:type="article"` and an `article:published_time` property.
*   [ ] Canonical and Open Graph URLs are absolute, utilizing the application's base URL environment variable.