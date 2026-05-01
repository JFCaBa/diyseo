import type {
  ArticleCoverImageGenerationContext,
  ArticleGenerationContext,
  BrandDNAGenerationContext
} from "@/lib/ai/types";
import { getTranslationLanguageLabel } from "@/lib/translations";

function valueOrFallback(value: string | null | undefined, fallback = "Not provided") {
  return value && value.trim().length > 0 ? value.trim() : fallback;
}

export function buildSystemPrompt(context: ArticleGenerationContext) {
  const brand = context.brandProfile;
  const contentLanguage = valueOrFallback(brand.contentLanguage, "English");
  const siteDomain = valueOrFallback(context.site.domain).replace(/\/$/, "");
  const siteName = valueOrFallback(context.site.name, "the site");

  return [
    "You are an expert SEO content writer.",
    "Write a highly relevant, brand-aligned article using the following Brand DNA.",
    "You MUST write the title, excerpt, contentMarkdown, seoTitle, and seoDescription in this exact language: " +
      contentLanguage +
      ".",
    "Do not default to English unless the content language is explicitly English.",
    "",
    "--- SITE ---",
    "Site Name: " + siteName,
    "Site Domain: " + siteDomain,
    "-----------------",
    "",
    "--- BRAND DNA ---",
    "Content Language: " + contentLanguage,
    "Business Type: " + valueOrFallback(brand.businessType),
    "Brand Voice & Tone: " + valueOrFallback(brand.brandVoiceTone),
    "Target Audience: " + valueOrFallback(brand.targetAudience),
    "Service Area: " + valueOrFallback(brand.serviceArea),
    "Topics To Avoid: " + valueOrFallback(brand.topicsToAvoid),
    "Key Themes: " + valueOrFallback(brand.keyThemes),
    "Custom Image Instructions: " + valueOrFallback(brand.customImageInstructions),
    "Image Style: " + valueOrFallback(brand.imageStyle),
    "-----------------",
    "",
    "Include 2 to 4 natural, contextual inline Markdown links [anchor](...) that point to the site domain above. Prefer the root domain and plausible category paths (e.g. /courses, /pricing, /about, /contact) derived from the business type and themes. Use descriptive anchor text, never bare URLs. Do not link to external sites.",
    "Also generate 5 to 7 SEO-friendly keyword suggestions based on the finished article title, article content, and Brand DNA. Each keyword must be a short phrase of 2 to 5 words.",
    "Ensure the article is useful, coherent, aligned with the brand guidance, and entirely written in the requested content language."
  ].join("\n");
}

export function buildUserPrompt(context: ArticleGenerationContext) {
  return [
    "Write a comprehensive article.",
    "Topic/Keyword: " + (context.keyword?.trim() || "A topic relevant to the brand mission"),
    "",
    "You MUST output your response as a valid JSON object with the following exact structure. Do not include markdown formatting like ```json.",
    "{",
    '  "title": "A catchy, SEO-friendly title (H1)",',
    '  "excerpt": "A short, engaging 2-3 sentence summary",',
    '  "contentMarkdown": "The full article content formatted in Markdown. Use headings, lists, quotes, code fences, and inline Markdown links where useful.",',
    '  "seoTitle": "Optimized meta title (under 60 characters)",',
    '  "seoDescription": "Optimized meta description (under 160 characters)",',
    '  "keywords": ["5 to 7 relevant SEO-friendly short phrases, each 2 to 5 words"]',
    "}"
  ].join("\n");
}

export function buildBrandDNASystemPrompt() {
  return [
    "You are an expert Brand Strategist and SEO Consultant.",
    "Your task is to define a useful Brand DNA profile for a website.",
    "You MUST write every returned field value in the requested content language.",
    "Do not default to English unless the requested language is explicitly English.",
    "You MUST output your response as a valid JSON object with the following exact structure.",
    "Do not include markdown formatting like ```json.",
    "{",
    '  "businessType": "Short description of the business model or category.",',
    '  "brandVoiceTone": "How the brand should sound in content.",',
    '  "targetAudience": "Description of the ideal customer profile.",',
    '  "serviceArea": "Primary market, geography, or scope served.",',
    '  "keyThemes": "Comma-separated list of primary content themes.",',
    '  "topicsToAvoid": "Comma-separated list of off-brand or irrelevant topics.",',
    '  "customImageInstructions": "Practical image direction aligned with the brand.",',
    '  "imageStyle": "Short reusable image style description."',
    "}"
  ].join("\n");
}

export function buildBrandDNAUserPrompt(context: BrandDNAGenerationContext) {
  return [
    "Generate a Brand DNA profile for the following business.",
    "Site Name: " + context.site.name,
    "Domain: " + context.site.domain,
    "Content Language: " + valueOrFallback(context.site.contentLanguage, "English"),
    "Business Description: " + (context.businessDescription?.trim() || "Infer based on the domain and site name"),
    "",
    "Keep the output practical, concise, suitable for a content-generation workflow, and fully written in the requested content language."
  ].join("\n");
}

export function buildArticleTranslationSystemPrompt(language: string) {
  const targetLanguage = getTranslationLanguageLabel(language);

  return [
    "You are an expert SEO translator and localization editor.",
    `Translate the provided article into ${targetLanguage}.`,
    "Return clean, natural localized copy rather than literal word-for-word output.",
    "Preserve the structure and intent of the original article.",
    "Translate the article title and excerpt as well as the SEO metadata.",
    "Keep Markdown formatting intact and return Markdown in the translated contentMarkdown field.",
    "Translate seoTitle and seoDescription into the same target language.",
    "Do not include explanations or commentary.",
    "You MUST output a valid JSON object and nothing else."
  ].join("\n");
}

export function buildArticleTranslationUserPrompt(input: {
  title: string;
  excerpt?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  contentMarkdown: string;
  language: string;
}) {
  return [
    `Target language code: ${input.language}`,
    `Original title: ${input.title}`,
    `Original excerpt: ${valueOrFallback(input.excerpt, "")}`,
    `Original SEO title: ${valueOrFallback(input.seoTitle, input.title)}`,
    `Original SEO description: ${valueOrFallback(input.seoDescription, input.excerpt || "")}`,
    "",
    "Original Markdown article:",
    input.contentMarkdown,
    "",
    "Return valid JSON with this exact structure:",
    "{",
    '  "title": "Translated article title",',
    '  "excerpt": "Translated article excerpt",',
    '  "contentMarkdown": "Translated article body in Markdown",',
    '  "seoTitle": "Translated SEO title under 60 characters",',
    '  "seoDescription": "Translated SEO description under 160 characters"',
    "}"
  ].join("\n");
}

function truncateImagePrompt(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3).trimEnd()}...` : value;
}

export function buildArticleCoverImagePrompt(context: ArticleCoverImageGenerationContext) {
  const brand = context.brandProfile;
  const contentLanguage = valueOrFallback(brand.contentLanguage, "English");
  const title = valueOrFallback(context.article.title, "Untitled article");
  const excerpt = valueOrFallback(context.article.excerpt, "No excerpt provided");
  const siteName = valueOrFallback(context.site.name, "the site");
  const siteDomain = valueOrFallback(context.site.domain, "the site domain");

  const prompt = [
    "Create a professional editorial blog cover image.",
    `Language context: ${contentLanguage}.`,
    `Site: ${siteName} (${siteDomain}).`,
    `Article title: ${title}.`,
    `Article excerpt: ${excerpt}.`,
    `Business type: ${valueOrFallback(brand.businessType)}.`,
    `Brand voice and tone: ${valueOrFallback(brand.brandVoiceTone)}.`,
    `Target audience: ${valueOrFallback(brand.targetAudience)}.`,
    `Service area: ${valueOrFallback(brand.serviceArea)}.`,
    `Key themes: ${valueOrFallback(brand.keyThemes)}.`,
    `Topics to avoid: ${valueOrFallback(brand.topicsToAvoid)}.`,
    `Preferred image style: ${valueOrFallback(brand.imageStyle, "Professional editorial photography or illustration aligned to the article topic")}.`,
    `Custom image instructions: ${valueOrFallback(brand.customImageInstructions, "None")}.`,
    "Use a clean, modern composition with a strong focal subject and enough negative space for a blog hero image crop.",
    "Do not include any text, letters, logos, UI, captions, watermarks, or typographic elements in the image.",
    "The result should feel polished, on-brand, realistic or editorially illustrated depending on the requested style, and suitable as a website article cover."
  ].join(" ");

  return truncateImagePrompt(prompt, 800);
}

export function buildArticleCoverImageNegativePrompt() {
  return truncateImagePrompt(
    [
      "No text, letters, words, captions, logos, watermark, signature, UI, screenshot, collage.",
      "Avoid low resolution, blur, distorted anatomy, warped hands, duplicate elements, chaotic composition, oversaturation, uncanny faces, generic AI artifacts."
    ].join(" "),
    500
  );
}
