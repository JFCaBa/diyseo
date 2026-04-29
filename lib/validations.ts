import { z } from "zod";
import { SEARCH_COUNTRY_OPTIONS, SEARCH_LANGUAGE_OPTIONS } from "@/lib/search-locale";
import { TRANSLATION_LANGUAGE_OPTIONS } from "@/lib/translations";

function normalizeGeneratedText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function truncateGeneratedText(value: string, maxLength: number) {
  return normalizeGeneratedText(value).slice(0, maxLength);
}

function normalizeGeneratedKeyword(value: string) {
  return normalizeGeneratedText(value).toLocaleLowerCase();
}

const GeneratedKeywordSchema = z
  .string()
  .transform((value) => normalizeGeneratedKeyword(value))
  .pipe(
    z
      .string()
      .min(1)
      .max(100)
      .refine((value) => value.split(/\s+/).length >= 2 && value.split(/\s+/).length <= 5, {
        message: "Generated keywords must be short phrases of 2 to 5 words."
      })
  );

export const CreateSiteSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(50),
  domain: z.string().url("Must be a valid URL (e.g., https://example.com)"),
  contentLanguage: z.string().min(2, "Content language is required").max(50).default("en")
});

export const UpdateBrandDNASchema = z.object({
  contentLanguage: z.string().max(100).optional(),
  businessType: z.string().max(200).optional(),
  brandVoiceTone: z.string().max(1000).optional(),
  targetAudience: z.string().max(1000).optional(),
  serviceArea: z.string().max(500).optional(),
  topicsToAvoid: z.string().max(1000).optional().transform((value) => value?.trim()),
  keyThemes: z.string().max(1000).optional().transform((value) => value?.trim()),
  customImageInstructions: z.string().max(2000).optional().transform((value) => value?.trim()),
  imageStyle: z.string().max(500).optional().transform((value) => value?.trim())
});

export const GenerateArticleRequestSchema = z.object({
  keyword: z.string().max(100).optional()
});

export const GeneratedArticleSchema = z.object({
  title: z.string().transform((value) => normalizeGeneratedText(value)).pipe(z.string().min(1)),
  excerpt: z.string().transform((value) => normalizeGeneratedText(value)).pipe(z.string().min(1)),
  contentMarkdown: z.string().transform((value) => value.trim()).pipe(z.string().min(1)),
  seoTitle: z
    .string()
    .transform((value) => truncateGeneratedText(value, 60))
    .pipe(z.string().min(1).max(60)),
  seoDescription: z
    .string()
    .transform((value) => truncateGeneratedText(value, 160))
    .pipe(z.string().min(1).max(160)),
  keywords: z
    .array(GeneratedKeywordSchema)
    .transform((keywords) => Array.from(new Set(keywords)).slice(0, 7))
    .pipe(z.array(GeneratedKeywordSchema).min(5).max(7))
});

export const GenerateBrandDNARequestSchema = z.object({
  businessDescription: z.string().max(500).optional()
});

export const GeneratedBrandDNASchema = z.object({
  businessType: z.string().min(1).max(200),
  brandVoiceTone: z.string().min(1).max(1000),
  targetAudience: z.string().min(1).max(1000),
  serviceArea: z.string().min(1).max(500),
  keyThemes: z.string().min(1).max(1000),
  topicsToAvoid: z.string().min(1).max(1000),
  customImageInstructions: z.string().min(1).max(2000),
  imageStyle: z.string().min(1).max(500)
});

export const ToggleArticleStatusSchema = z.object({
  articleId: z.string().cuid("Invalid Article ID"),
  status: z.enum(["DRAFT", "PUBLISHED"])
});

export const DeleteArticleSchema = z.object({
  articleId: z.string().cuid("Invalid Article ID")
});

export const CreateKeywordSchema = z.object({
  term: z.string().min(1, "Keyword term is required").max(100)
});

export const AssignKeywordSchema = z.object({
  articleId: z.string().cuid(),
  keywordId: z.union([z.string().cuid(), z.literal("")]).transform((value) => value || null)
});

export const UpdateSearchConsolePropertySchema = z.object({
  propertyUrl: z.string().min(1, "Property selection is required").max(500)
});

export const UpdateWidgetThemeSchema = z.object({
  widgetTheme: z.enum(["light", "dark"])
});

export const UpdateAutoPublishSettingsSchema = z.object({
  autoPublishEnabled: z.boolean(),
  articlesPerWeek: z.coerce
    .number()
    .int("Articles per week must be a whole number.")
    .min(1, "Articles per week must be at least 1.")
    .max(50, "Articles per week must be 50 or less."),
  requireReview: z.boolean()
});

export const UpdateSearchLocaleDefaultsSchema = z.object({
  defaultSearchCountry: z.enum(SEARCH_COUNTRY_OPTIONS.map((option) => option.value) as [string, ...string[]]),
  defaultSearchLanguage: z.enum(SEARCH_LANGUAGE_OPTIONS.map((option) => option.value) as [string, ...string[]])
});

export const UpdateTranslationSettingsSchema = z.object({
  translationsEnabled: z.boolean(),
  translationLanguages: z
    .array(z.enum(TRANSLATION_LANGUAGE_OPTIONS.map((option) => option.code) as [string, ...string[]]))
    .max(TRANSLATION_LANGUAGE_OPTIONS.length)
});

export const GenerateArticleTranslationSchema = z.object({
  articleId: z.string().cuid("Invalid Article ID"),
  language: z.enum(TRANSLATION_LANGUAGE_OPTIONS.map((option) => option.code) as [string, ...string[]])
});

export const GeneratedArticleTranslationSchema = z.object({
  title: z.string().transform((value) => normalizeGeneratedText(value)).pipe(z.string().min(1).max(200)),
  excerpt: z
    .string()
    .transform((value) => normalizeGeneratedText(value))
    .pipe(z.string().min(1).max(2000))
    .nullable()
    .optional(),
  contentMarkdown: z.string().transform((value) => value.trim()).pipe(z.string().min(1)),
  seoTitle: z
    .string()
    .transform((value) => truncateGeneratedText(value, 60))
    .pipe(z.string().min(1).max(60)),
  seoDescription: z
    .string()
    .transform((value) => truncateGeneratedText(value, 160))
    .pipe(z.string().min(1).max(160))
});

export const TransferSiteSchema = z.object({
  email: z.string().email("Enter a valid user email.")
});

export const CreatePublishingApiKeySchema = z.object({
  label: z.string().trim().min(1, "Key label is required.").max(80, "Key label must be 80 characters or less.")
});

export const RevokePublishingApiKeySchema = z.object({
  keyId: z.string().cuid("Invalid key ID")
});

export const DeleteSiteSchema = z.object({
  confirmName: z.string().min(1, "Type the site name to confirm deletion.")
});

export const UpdateArticleSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  excerpt: z.string().max(2000).optional().nullable(),
  coverImageUrl: z.string().url("Cover image must be a valid URL").max(2000).optional().nullable(),
  contentMarkdown: z.string().min(1, "Content is required"),
  seoTitle: z.string().max(60, "SEO Title should be under 60 characters").optional().nullable(),
  seoDescription: z.string().max(160, "SEO Description should be under 160 characters").optional().nullable()
});

export const CreateArticleSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  excerpt: z.string().max(2000).optional().nullable(),
  coverImageUrl: z.string().url("Cover image must be a valid URL").max(2000).optional().nullable(),
  contentMarkdown: z.string().min(1, "Content is required"),
  seoTitle: z.string().max(60, "SEO Title should be under 60 characters").optional().nullable(),
  seoDescription: z.string().max(160, "SEO Description should be under 160 characters").optional().nullable(),
  publishedDate: z.union([z.string().date(), z.literal(""), z.null()]).transform((value) => value || null),
  returnTo: z.string().optional()
});

export const PublishArticleApiPayloadSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200, "Title must be 200 characters or less."),
  slug: z.string().trim().max(120, "Slug must be 120 characters or less.").optional(),
  excerpt: z.string().max(2000, "Excerpt must be 2000 characters or less.").optional().nullable(),
  coverImageUrl: z.string().url("Cover image must be a valid URL").max(2000).optional().nullable(),
  contentMarkdown: z
    .string()
    .trim()
    .min(1, "contentMarkdown is required")
    .max(100_000, "contentMarkdown is too large."),
  seoTitle: z.string().max(60, "SEO Title should be under 60 characters").optional().nullable(),
  seoDescription: z.string().max(160, "SEO Description should be under 160 characters").optional().nullable(),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
  publishedAt: z.string().datetime({ offset: true }).optional().nullable()
});

export const UpdateArticleDateSchema = z.object({
  articleId: z.string().cuid("Invalid Article ID"),
  newDate: z.string().datetime({ offset: true }).nullable(),
  returnTo: z.string().optional()
});

export const AnalyticsRouteParamsSchema = z.object({
  siteId: z.string().cuid("Invalid Site ID")
});

export const GetSiteConfigSchema = z.object({
  siteId: z.string().cuid("Invalid Site ID")
});

export const PublicArticleRouteParamsSchema = z.object({
  siteId: z.string().cuid("Invalid Site ID"),
  slug: z.string().min(1).max(100)
});

export const PublicBlogIndexRouteParamsSchema = z.object({
  siteId: z.string().cuid("Invalid Site ID")
});

export const RSSRouteParamsSchema = z.object({
  siteId: z.string().cuid("Invalid Site ID")
});

export const SitemapRouteParamsSchema = z.object({
  siteId: z.string().cuid("Invalid Site ID")
});

export const AtomRouteParamsSchema = z.object({
  siteId: z.string().cuid("Invalid Site ID")
});

export type CreateSiteInput = z.infer<typeof CreateSiteSchema>;
export type BrandDNAInput = z.infer<typeof UpdateBrandDNASchema>;
export type GenerateArticleRequestInput = z.infer<typeof GenerateArticleRequestSchema>;
export type GeneratedArticleInput = z.infer<typeof GeneratedArticleSchema>;
export type GenerateBrandDNARequestInput = z.infer<typeof GenerateBrandDNARequestSchema>;
export type GeneratedBrandDNAInput = z.infer<typeof GeneratedBrandDNASchema>;
export type ToggleArticleStatusInput = z.infer<typeof ToggleArticleStatusSchema>;
export type DeleteArticleInput = z.infer<typeof DeleteArticleSchema>;
export type CreateKeywordInput = z.infer<typeof CreateKeywordSchema>;
export type UpdateSearchConsolePropertyInput = z.infer<typeof UpdateSearchConsolePropertySchema>;
export type UpdateWidgetThemeInput = z.infer<typeof UpdateWidgetThemeSchema>;
export type UpdateAutoPublishSettingsInput = z.infer<typeof UpdateAutoPublishSettingsSchema>;
export type UpdateSearchLocaleDefaultsInput = z.infer<typeof UpdateSearchLocaleDefaultsSchema>;
export type UpdateTranslationSettingsInput = z.infer<typeof UpdateTranslationSettingsSchema>;
export type TransferSiteInput = z.infer<typeof TransferSiteSchema>;
export type CreatePublishingApiKeyInput = z.infer<typeof CreatePublishingApiKeySchema>;
export type RevokePublishingApiKeyInput = z.infer<typeof RevokePublishingApiKeySchema>;
export type DeleteSiteInput = z.infer<typeof DeleteSiteSchema>;
export type UpdateArticleInput = z.infer<typeof UpdateArticleSchema>;
export type CreateArticleInput = z.infer<typeof CreateArticleSchema>;
export type GenerateArticleTranslationInput = z.infer<typeof GenerateArticleTranslationSchema>;
export type GeneratedArticleTranslationInput = z.infer<typeof GeneratedArticleTranslationSchema>;
export type PublishArticleApiPayloadInput = z.infer<typeof PublishArticleApiPayloadSchema>;
