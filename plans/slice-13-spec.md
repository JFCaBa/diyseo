# Slice 13 Architecture Plan: Public Site Config API

## 1. Objective
Define the architecture for Slice 13, which introduces a public read-only API endpoint to serve basic site configuration and display settings to the embeddable widget. This allows the widget to dynamically adapt its presentation based on the site's `BrandProfile` and `SiteProject` settings.

## 2. Scope & Constraints
*   **Included**: A new public API endpoint to expose minimal site configuration (name, language, image style, base path) and the necessary adjustments to the embeddable widget's initialization flow.
*   **Constraints**: Must be completely backward-compatible with the existing widget initialization (Slice 3). No changes to the AI logic. Keep the payload minimal to ensure fast widget load times.

## 3. Database Usage
No schema changes are required. The endpoint will query existing data from:
*   `SiteProject`: Extracts the `name`.
*   `BrandProfile`: Extracts the `language` (from Slice 9) and `imageStyle` (from Slice 11).

*Note: The `basePath` can be dynamically constructed based on the server's environment or request headers, ensuring the widget always knows where to point subsequent API calls.*

## 4. Public API Route Design

### 4.1. Get Site Config
*   **Endpoint**: `GET /api/public/sites/:siteId/config`
*   **Description**: Retrieves minimal public configuration data necessary for rendering the site's content securely.
*   **Behavior**: Returns a JSON object with site display properties. Returns a 404 if the site does not exist.
*   **Response Schema**:
    ```typescript
    type SiteConfigResponse = {
      siteName: string;
      language: string;
      imageStyle: string | null;
      basePath: string; // The URL of the platform serving this data
    };
    ```

## 5. Widget Integration Impact
The widget (`embed.js` from Slice 3) must be updated to consume this new endpoint without breaking existing implementations.

### 5.1. Initialization Flow
1.  The script reads `data-site` and `data-base-path` from its `<script>` tag (as it does currently).
2.  **New Step**: Before rendering the article list, the widget performs a `fetch()` to `GET ${data-base-path}/api/public/sites/${data-site}/config`.
3.  The widget stores this configuration object in its internal state.
4.  **Graceful Fallback**: If the `/config` fetch fails (e.g., network error), the widget should catch the error and fall back to rendering the article list normally, using generic defaults (e.g., English language, no specific image style).

### 5.2. Usage of Config Data
*   **Language**: Can be used to set the `lang` attribute on internal widget containers or format dates correctly (e.g., `Intl.DateTimeFormat(config.language)`).
*   **Site Name**: Can be used as a fallback title in empty states or error messages.
*   **Image Style**: Saved for future use when article images are introduced, allowing the widget to apply CSS filters or request specific image formats.

## 6. Validation Rules (Zod)

```typescript
import { z } from 'zod';

// Only validating the URL parameter for the GET request
export const GetSiteConfigSchema = z.object({
  siteId: z.string().cuid("Invalid Site ID"),
});
```

## 7. Acceptance Criteria
*   [ ] A new public GET route exists at `/api/public/sites/:siteId/config`.
*   [ ] The route successfully queries and returns `siteName`, `language`, and `imageStyle` from the database.
*   [ ] The route requires no authentication.
*   [ ] The `embed.js` script is updated to fetch this configuration data during initialization.
*   [ ] The widget uses the fetched `language` to format the `publishedAt` dates in the article list.
*   [ ] The widget does not break or crash if the configuration fetch fails (graceful degradation).
*   [ ] The existing article listing and article detail API endpoints from Slice 2 remain unchanged.