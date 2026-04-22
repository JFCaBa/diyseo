# Slice 21 Architecture Plan: Public Blog Styling Polish

## 1. Objective
Define the architecture for Slice 21, which focuses on polishing the visual presentation of the public-facing blog index and article detail pages. The goal is to improve readability and ensure a professional, clean aesthetic without introducing new features, data, or complete redesigns.

## 2. Scope & Constraints
*   **Included**: Typography adjustments, spacing (margin/padding) improvements, and subtle visual enhancements for article cards on the index page and the reading layout on the detail page.
*   **Constraints**: No changes to the existing routes, data fetching logic, public API, embeddable widget, or AI generation. Must rely exclusively on Tailwind CSS utility classes or `@tailwindcss/typography` (the `prose` plugin). Keep it minimal and stable.

## 3. Styling Scope & UI Behavior

### 3.1. General Typography & Layout
*   **Container Width**: Constrain the maximum width of the reading content to optimize line length for readability (e.g., `max-w-3xl` or `max-w-prose`).
*   **Font Hierarchy**: Establish a clear visual hierarchy between `H1`, `H2`, `H3` tags and paragraph text using consistent font weights and sizes.
*   **Color Palette**: Use a high-contrast text color for main content (e.g., `text-gray-900` or `text-slate-800` in light mode) and muted colors for metadata like dates or excerpts (e.g., `text-gray-500`).

### 3.2. Blog Index Page (`/blog/[siteId]`)
*   **Article Cards**: 
    *   Add consistent vertical spacing between articles (e.g., `space-y-8`).
    *   Style the `title` as a prominent block element. Add a subtle hover effect to the link (e.g., `hover:text-blue-600` or an underline transition).
    *   Style the `publishedAt` date using a smaller font size, uppercase tracking, or muted color to separate it from the title and excerpt.
    *   Ensure the `excerpt` has a comfortable line height (`leading-relaxed`) to encourage reading.

### 3.3. Article Detail Page (`/blog/[siteId]/[slug]`)
*   **Header Section**: 
    *   Give the `title` significant visual weight (`text-4xl`, `font-bold`).
    *   Style the `excerpt` distinctly from the body text, acting as a "lead" paragraph (e.g., slightly larger font size, italicized, or darker text color than the body).
    *   Ensure the "Back to Blog" link (from Slice 20) is unobtrusive but easy to interact with.
*   **Content Body**: 
    *   Apply the Tailwind Typography plugin (`className="prose prose-lg"`) to the container holding the raw HTML content. This automatically handles spacing, list styling, blockquotes, and link styling within the injected HTML.
    *   Ensure adequate padding below the header section before the content begins.

## 4. Responsive Design Rules
*   Ensure padding adjusts gracefully for mobile devices (e.g., `px-4` on mobile, `px-0` or wider container bounds on desktop).
*   Ensure text sizes scale down slightly on smaller screens to prevent overflow and maintain a comfortable reading experience.

## 5. Acceptance Criteria
*   [ ] The blog index page (`/blog/[siteId]`) displays articles with clear visual separation, prominent titles, and muted publication dates.
*   [ ] The article detail page (`/blog/[siteId]/[slug]`) utilizes a constrained maximum width for optimal readability line lengths.
*   [ ] Raw HTML content on the detail page is rendered with consistent typography, margins, and list styles (e.g., via the Tailwind `prose` class).
*   [ ] The article excerpt is styled distinctly from the main body content.
*   [ ] Hover states provide clear feedback on interactive elements (titles, links).
*   [ ] The layout is fully responsive, adjusting padding and font sizes correctly on mobile devices.
*   [ ] No underlying data structures or routes were altered to achieve the styling changes.