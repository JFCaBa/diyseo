# Slice 12 Architecture Plan: Auto-generated Brand DNA Bootstrap

## 1. Objective
Define the architecture for Slice 12, which introduces a feature to auto-generate a draft of the `BrandProfile` (Brand DNA) using AI. This helps users quickly bootstrap their content strategy by generating fields like target audience, tone of voice, and key themes based on basic site information.

## 2. Scope & Constraints
*   **Included**: AI generation flow for Brand DNA fields, a manual trigger button on the Brand DNA page, populating the editor with the generated values, and optionally saving them to the database.
*   **Inputs**: Site Name, Domain, and an optional "Business Description" prompt.
*   **Outputs**: Target Audience, Tone of Voice, Core Values, Mission Statement, Key Themes, Topics to Avoid.
*   **Constraints**: Must use the provider-agnostic AI service abstraction established in Slice 4. No changes to the public API or embeddable widget. Keep the UI minimal.

## 3. Database Usage
No new database models or fields are required. This feature populates the existing `BrandProfile` fields (established in Slices 1 and 11).

## 4. Prompt Structure & Context
The generation relies on a strict JSON-output prompt to populate the specific Brand DNA fields.

### 4.1. System Prompt Template
```text
You are an expert Brand Strategist and SEO Consultant. Your task is to define a comprehensive Brand DNA profile for a given website. 
You MUST output your response as a valid JSON object with the following exact structure. Do not include markdown formatting like ```json.
{
  "targetAudience": "Description of the ideal customer profile.",
  "toneOfVoice": "Adjectives and description of how the brand speaks.",
  "coreValues": "3-5 core principles guiding the brand.",
  "missionStatement": "A concise, impactful mission statement.",
  "keyThemes": "Comma-separated list of primary content topics.",
  "topicsToAvoid": "Comma-separated list of off-brand topics."
}
```

### 4.2. User Prompt Template
```text
Generate a Brand DNA profile for the following business:
Site Name: {{site.name}}
Domain: {{site.domain}}
Business Description: {{optionalDescription || "Infer based on the domain and name"}}
```

## 5. API Design & Generation Flow

We will create a new internal Next.js API route or Server Action to handle the generation request.

### 5.1. Internal Generation Endpoint
*   **Endpoint**: `POST /api/internal/sites/:siteId/brand-dna/generate`
*   **Request Body**:
    ```typescript
    {
      businessDescription?: string;
    }
    ```

### 5.2. Generation Workflow
1.  **Request Received**: Client triggers generation, optionally providing a short business description.
2.  **Context Assembly**: Backend fetches the `SiteProject` to get the `name` and `domain`.
3.  **Prompt Construction**: Injects inputs into the prompt templates.
4.  **AI Invocation**: Calls the provider-agnostic `AIGenerationService` (reusing the abstraction from Slice 4).
5.  **Parsing & Validation**: Parses the JSON and validates it against the `GeneratedBrandDNASchema`.
6.  **Database Update**: Updates the `BrandProfile` record in the database with the generated values.
7.  **Response**: Returns the generated data so the UI can immediately reflect the new values.

## 6. UI Behavior
*   **Location**: `/[siteId]/brand-dna` (The Brand DNA Editor).
*   **Action**: An "Auto-Generate Brand DNA" button, ideally placed at the top of the form or in an empty state if the DNA is entirely blank.
*   **Optional Input**: Clicking the button can open a small modal or reveal a text input asking for an optional "Brief Business Description" before triggering the generation.
*   **Feedback**: Show a loading state during generation. Upon success, the form fields update automatically with the generated content. The user can then manually edit these drafts before final approval.

## 7. Validation Rules (Zod)

```typescript
import { z } from 'zod';

export const GenerateBrandDNARequestSchema = z.object({
  businessDescription: z.string().max(500).optional(),
});

export const GeneratedBrandDNASchema = z.object({
  targetAudience: z.string().min(1),
  toneOfVoice: z.string().min(1),
  coreValues: z.string().min(1),
  missionStatement: z.string().min(1),
  keyThemes: z.string().min(1),
  topicsToAvoid: z.string().min(1),
});
```

## 8. Acceptance Criteria
*   [ ] An "Auto-Generate Brand DNA" button exists on the Brand DNA page.
*   [ ] The generation logic successfully uses the site's name and domain (and optional description) to construct the prompt.
*   [ ] The AI output is strictly validated against the expected JSON schema.
*   [ ] The generated values automatically populate the form fields in the UI.
*   [ ] The generated values are saved to the database.
*   [ ] The generation logic reuses the provider-agnostic architecture defined in Slice 4.