import type { ArticleGenerationContext, BrandDNAGenerationContext } from "@/lib/ai/types";

function valueOrFallback(value: string | null | undefined, fallback = "Not provided") {
  return value && value.trim().length > 0 ? value.trim() : fallback;
}

export function buildSystemPrompt(context: ArticleGenerationContext) {
  const brand = context.brandProfile;
  const contentLanguage = valueOrFallback(brand.contentLanguage, "English");

  return [
    "You are an expert SEO content writer.",
    "Write a highly relevant, brand-aligned article using the following Brand DNA.",
    "You MUST write the title, excerpt, contentHtml, seoTitle, and seoDescription in this exact language: " +
      contentLanguage +
      ".",
    "Do not default to English unless the content language is explicitly English.",
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
    '  "contentHtml": "The full article content formatted in semantic HTML5 (do not include <html>, <head>, or <body> tags, start with <h2> or <p>)",',
    '  "seoTitle": "Optimized meta title (under 60 characters)",',
    '  "seoDescription": "Optimized meta description (under 160 characters)"',
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
