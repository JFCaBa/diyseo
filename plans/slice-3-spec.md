# Slice 3 Architecture Plan: Embeddable Widget v1

## 1. Objective
Define the architecture for Slice 3, which introduces a lightweight, vanilla JavaScript embeddable widget. This widget will consume the public API defined in Slice 2 to render a list of published articles and full article details directly on any external host website.

## 2. Scope & Constraints
*   **Included**: Vanilla JS widget script (`embed.js`), client-side rendering logic for article lists and details, basic navigation, minimal styling, configuration via HTML data attributes.
*   **Constraints**: Must use the exact API defined in Slice 2. NO backend or API changes. Must be lightweight (no heavy frontend frameworks like React/Vue inside the widget). Must not conflict with the host site's styles or scripts.

## 3. Widget Architecture & Deployment

### 3.1. File Location
The widget will be developed as a standalone JavaScript file and served statically from the Next.js application.
*   Path: `public/embed.js` (accessible at `https://[your-platform-domain]/embed.js`)

### 3.2. Integration Format
Host websites will integrate the widget using a single `<script>` tag placed anywhere on their page (typically just before the closing `</body>` tag).

```html
<script 
  src="https://[your-platform-domain]/embed.js" 
  data-site="[siteId-from-platform]" 
  data-base-path="https://[your-platform-domain]"
></script>

<!-- Optional: Host can provide a container. If missing, the widget creates one. -->
<div id="soro-widget-container"></div>
```

### 3.3. Configuration Data Attributes
The script extracts configuration from its own HTML element:
*   `data-site`: (Required) The unique ID of the `SiteProject` to fetch articles for.
*   `data-base-path`: (Required) The base URL of the self-hosted SEO platform (where the `/api/public` routes live).

## 4. Rendering Flow & Logic

The widget handles routing client-side to prevent full page reloads on the host site. It uses URL query parameters (e.g., `?article=slug`) or hash routing (e.g., `#article/slug`) to manage state and allow direct linking to specific articles.

### 4.1. Initialization
1.  The script executes and looks for its configuration attributes.
2.  It looks for a container element with the ID `soro-widget-container`. If not found, it appends a new `div` to the document body.
3.  It checks the current URL to determine which view to render initially (List or Detail).

### 4.2. Article List View (Default)
1.  **Fetch**: Calls `GET ${dataBasePath}/api/public/sites/${dataSite}/articles`.
2.  **Render**: Displays a simple list of article titles and publish dates.
3.  **Interaction**: Clicking a title intercepts the default link behavior, updates the browser URL (e.g., appending `?article=slug`), and triggers the Detail View render.

### 4.3. Article Detail View
1.  **State Extraction**: Reads the requested slug from the URL.
2.  **Fetch**: Calls `GET ${dataBasePath}/api/public/sites/${dataSite}/articles/${slug}`.
3.  **Render**: 
    *   Displays a "Back to Articles" button.
    *   Displays the article title and formatted `publishedAt` date.
    *   Injects the `content` into the DOM. (Note: Since V1 uses raw text or simple Markdown, the widget may need a lightweight Markdown parser if content is not pre-rendered to HTML on the backend).
4.  **Interaction**: Clicking the "Back" button updates the URL and triggers the List View render.

## 5. Styling Approach
To ensure the widget looks acceptable out of the box but remains highly customizable:

*   **No Global CSS**: The script injects a `<style>` block containing minimal, scoped CSS rules targeting only elements within `#soro-widget-container`.
*   **CSS Variables**: Styling will rely on CSS custom properties (e.g., `var(--soro-primary-color, #000)`) allowing the host site to easily theme the widget in their own stylesheets.
*   **Semantic HTML**: The widget will output standard, semantic HTML elements (`<article>`, `<h1>`, `<ul>`, `<li>`, `<a>`) making it easy to target with existing host CSS if they choose to do so.

Example Injected CSS:
```css
#soro-widget-container {
  font-family: inherit;
  line-height: 1.5;
  color: var(--soro-text-color, inherit);
}
.soro-article-list { list-style: none; padding: 0; }
.soro-article-item { margin-bottom: 1rem; }
.soro-back-button { cursor: pointer; text-decoration: underline; color: var(--soro-link-color, blue); }
```

## 6. Integration with Slice 2 API (Example Code)

```javascript
// Inside embed.js
const basePath = scriptTag.getAttribute('data-base-path');
const siteId = scriptTag.getAttribute('data-site');

async function fetchArticles() {
  const response = await fetch(`${basePath}/api/public/sites/${siteId}/articles`);
  if (!response.ok) throw new Error('Failed to fetch articles');
  return response.json();
}

async function fetchArticle(slug) {
  const response = await fetch(`${basePath}/api/public/sites/${siteId}/articles/${slug}`);
  if (!response.ok) throw new Error('Article not found');
  return response.json();
}
```

## 7. Acceptance Criteria
*   [ ] The `embed.js` file is served from the Next.js `public` directory.
*   [ ] A host HTML file can include the widget script tag with `data-site` and `data-base-path` attributes.
*   [ ] The widget automatically fetches and renders the list of published articles from the Slice 2 API.
*   [ ] Clicking an article title navigates to the article detail view without a full page reload.
*   [ ] The detail view correctly fetches and displays the full article content.
*   [ ] A functional "Back" button exists on the detail view to return to the list.
*   [ ] The widget does not throw errors if no articles are found or if an invalid slug is requested (it should show a friendly empty state or 404 message).
*   [ ] The styling is minimal and does not override global host styles outside the widget container.