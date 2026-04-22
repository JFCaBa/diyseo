# Slice 14 Architecture Plan: Widget Config Polish

## 1. Objective
Define the architecture for Slice 14, focusing on polishing the embeddable widget's configuration system. This allows the host site to override configuration values dynamically via script HTML attributes, providing maximum flexibility while maintaining a clean central configuration source.

## 2. Scope & Constraints
*   **Included**: Enhancing the `embed.js` script to read optional `data-*` attributes (`data-theme`, `data-title`) in addition to the required `data-site` and `data-base-path`. Implementing strict precedence rules for configuration merging.
*   **Constraints**: Must be 100% backward compatible with existing widget deployments (Slices 3 and 13). No breaking changes to the public API. No AI logic changes. Must remain lightweight and stable.

## 3. Configuration Precedence & Merge Rules

The widget will build its final configuration object by merging data from three distinct layers. The highest priority layer overwrites any conflicting values from the lower layers.

### Precedence Hierarchy (Highest to Lowest):

1.  **Script HTML Attributes (Highest Priority)**: Values explicitly provided on the `<script>` tag by the host developer. These override everything.
    *   `data-site` (Required)
    *   `data-base-path` (Required)
    *   `data-theme` (Overrides API `imageStyle` or default visual theme)
    *   `data-title` (Overrides API `siteName` or default title)
2.  **API Configuration (Medium Priority)**: Values fetched from the `/api/public/sites/:siteId/config` endpoint (introduced in Slice 13).
    *   `siteName` (Maps to `title` state)
    *   `language`
    *   `imageStyle` (Maps to `theme` state)
3.  **Widget Defaults (Lowest Priority)**: Hardcoded fallback values within the `embed.js` script used if neither the API nor script attributes provide a value.
    *   `title`: "Latest Articles"
    *   `language`: "en"
    *   `theme`: "default"

## 4. Widget Behavior & Integration

### 4.1. Initialization Flow Update
The initialization sequence in `embed.js` is updated to handle the merging logic:

1.  **Extract Attributes**: Parse all `data-*` attributes from the script tag into a local `scriptConfig` object.
2.  **Fetch API Data**: Asynchronously request the configuration from the API endpoint.
3.  **Merge**: Construct the `finalConfig` object:
    ```javascript
    // Conceptual Merge Logic inside embed.js
    const finalConfig = {
      title: scriptConfig['data-title'] || apiConfig?.siteName || "Latest Articles",
      theme: scriptConfig['data-theme'] || apiConfig?.imageStyle || "default",
      language: apiConfig?.language || "en",
      siteId: scriptConfig['data-site'],
      basePath: scriptConfig['data-base-path'],
    };
    ```
4.  **Render**: Use `finalConfig` to drive the rendering logic (e.g., setting the header title, applying CSS classes based on the theme).

### 4.2. CSS & Theming Implications
*   If `finalConfig.theme` resolves to a specific value (e.g., "minimalist"), the widget can append a modifier class like `.soro-theme-minimalist` to the root `#soro-widget-container`. This allows the host site to easily write CSS targeting specific structural variants.

## 5. Validation & Error Handling

*   **Client-Side Validation**: Ensure `data-site` and `data-base-path` exist on the script tag. If they are missing, log a clear console error and abort initialization.
*   **Graceful Degradation**: If the API fetch fails, the merge logic automatically relies on the `scriptConfig` attributes and Widget Defaults, ensuring the widget never fails to render due to a non-critical config request failure.

## 6. Acceptance Criteria
*   [ ] The `embed.js` script correctly extracts `data-title` and `data-theme` attributes if present on the script tag.
*   [ ] The widget correctly applies the precedence rules: script attributes override API data, which overrides internal defaults.
*   [ ] If a host uses `data-title="My Custom News"`, the widget header displays "My Custom News", regardless of what the API returns for `siteName`.
*   [ ] If the API fetch fails or times out, the widget successfully renders using only script attributes and defaults.
*   [ ] Existing widget deployments (using only `data-site` and `data-base-path`) continue to function perfectly without modification.
*   [ ] The public API remains completely unchanged.