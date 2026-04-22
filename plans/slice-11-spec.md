# Slice 11 Architecture Plan: Brand DNA Improvements

## 1. Objective
Define the architecture for Slice 11, which focuses on enhancing the `BrandProfile` (Brand DNA) to capture more structured data. This will improve the quality of future AI-generated content by providing cleaner, more specific context regarding themes, topics to avoid, and visual identity.

## 2. Scope & Constraints
*   **Included**: Database schema updates for the `BrandProfile` model, UI enhancements to the `/[siteId]/brand-dna` page, and data normalization logic before saving.
*   **New Fields**: `topicsToAvoid`, `keyThemes`, `customImageInstructions`, `imageStyle`.
*   **Constraints**: No changes to the public API, embeddable widget, or current AI generation logic. Must remain minimal and stable.

## 3. Database Schema Updates (Prisma)

We will extend the existing `BrandProfile` model. For simplicity and stability in V1, we will store array-like data (themes, topics) as simple `String` types (either comma-separated or newline-separated), which maps perfectly to textareas and is easily injected into AI prompts later.

### 3.1. Updated Model: `BrandProfile`
```prisma
model BrandProfile {
  // ... existing fields (id, siteProjectId, language, targetAudience, toneOfVoice, coreValues, missionStatement, createdAt, updatedAt)

  // New Content Strategy Fields
  keyThemes               String?  @db.Text // Store as newline or comma-separated string
  topicsToAvoid           String?  @db.Text // Store as newline or comma-separated string

  // New Visual Identity Fields
  imageStyle              String?  // e.g., "Minimalist", "Photorealistic", "Illustration"
  customImageInstructions String?  @db.Text // Detailed prompt instructions for future image generation

  // ... relation definitions
}
```

## 4. UI Behavior & Enhancements

### 4.1. Brand DNA Page (`/[siteId]/brand-dna`)
*   **Layout grouping**: Improve UX by grouping the form fields into logical sections using cards or distinct visual sections:
    *   **Core Identity**: Language, Mission Statement, Core Values.
    *   **Audience & Voice**: Target Audience, Tone of Voice.
    *   **Content Strategy**: Key Themes (Textarea), Topics to Avoid (Textarea). Provide helper text advising users to separate items with commas or new lines.
    *   **Visual Identity**: Image Style (Select dropdown or Text input), Custom Image Instructions (Textarea).
*   **Action**: A single "Save Brand DNA" button that persists all fields.

## 5. Normalization & Validation Rules (Zod)

Before saving to the database, text inputs (especially lists) must be normalized to ensure clean data for future prompting.

### 5.1. Normalization Rules
*   Trim leading/trailing whitespace from all strings.
*   For `keyThemes` and `topicsToAvoid`: If entered as a comma-separated list, ensure consistent spacing (e.g., replace `, ` with `,`). Alternatively, normalize newlines to a consistent format.

### 5.2. Zod Schema
```typescript
import { z } from 'zod';

export const UpdateBrandDNASchema = z.object({
  // ... existing fields
  language: z.string().optional(),
  targetAudience: z.string().max(1000).optional(),
  toneOfVoice: z.string().max(500).optional(),
  coreValues: z.string().max(500).optional(),
  missionStatement: z.string().max(1000).optional(),
  
  // New fields
  keyThemes: z.string().max(1000).optional()
    .transform(val => val?.trim()),
  topicsToAvoid: z.string().max(1000).optional()
    .transform(val => val?.trim()),
  imageStyle: z.string().max(100).optional()
    .transform(val => val?.trim()),
  customImageInstructions: z.string().max(1000).optional()
    .transform(val => val?.trim()),
});
```

## 6. Internal API & Server Actions
Update the existing Server Action `updateBrandDNA(siteId: string, data: BrandDNAInput)` (from Slice 1) to accept and process the new fields.

## 7. Acceptance Criteria
*   [ ] The `BrandProfile` database schema includes `topicsToAvoid`, `keyThemes`, `imageStyle`, and `customImageInstructions`.
*   [ ] The `/[siteId]/brand-dna` UI is updated to include inputs for the new fields, grouped logically.
*   [ ] Form submissions successfully trim whitespace and save the data to the database via the updated Server Action.
*   [ ] The form accurately re-populates with the saved data upon page reload.
*   [ ] Existing fields (mission, tone, etc.) continue to function without regression.
*   [ ] The public API and AI generation (Slice 4) are completely unaffected.