import { z } from "zod";

function normalizeGeneratedText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function truncateGeneratedText(value: string, maxLength: number) {
  return normalizeGeneratedText(value).slice(0, maxLength);
}

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
  contentHtml: z.string().transform((value) => value.trim()).pipe(z.string().min(1)),
  seoTitle: z
    .string()
    .transform((value) => truncateGeneratedText(value, 60))
    .pipe(z.string().min(1).max(60)),
  seoDescription: z
    .string()
    .transform((value) => truncateGeneratedText(value, 160))
    .pipe(z.string().min(1).max(160))
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

export const CreateKeywordSchema = z.object({
  term: z.string().min(1, "Keyword term is required").max(100)
});

export const AssignKeywordSchema = z.object({
  articleId: z.string().cuid(),
  keywordId: z.union([z.string().cuid(), z.literal("")]).transform((value) => value || null)
});

export const UpdateArticleSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  excerpt: z.string().max(2000).optional().nullable(),
  contentHtml: z.string().min(1, "Content is required"),
  seoTitle: z.string().max(60, "SEO Title should be under 60 characters").optional().nullable(),
  seoDescription: z.string().max(160, "SEO Description should be under 160 characters").optional().nullable()
});

export const CreateArticleSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  excerpt: z.string().max(2000).optional().nullable(),
  contentHtml: z.string().min(1, "Content is required"),
  seoTitle: z.string().max(60, "SEO Title should be under 60 characters").optional().nullable(),
  seoDescription: z.string().max(160, "SEO Description should be under 160 characters").optional().nullable(),
  publishedDate: z.union([z.string().date(), z.literal(""), z.null()]).transform((value) => value || null),
  returnTo: z.string().optional()
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
export type CreateKeywordInput = z.infer<typeof CreateKeywordSchema>;
export type UpdateArticleInput = z.infer<typeof UpdateArticleSchema>;
export type CreateArticleInput = z.infer<typeof CreateArticleSchema>;
