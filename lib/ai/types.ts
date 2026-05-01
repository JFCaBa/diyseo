import type { GeneratedArticleInput, GeneratedBrandDNAInput } from "@/lib/validations";

export type ArticleGenerationContext = {
  keyword?: string;
  site: {
    name: string;
    domain: string;
  };
  brandProfile: {
    contentLanguage?: string | null;
    businessType?: string | null;
    brandVoiceTone?: string | null;
    targetAudience?: string | null;
    serviceArea?: string | null;
    topicsToAvoid?: string | null;
    keyThemes?: string | null;
    customImageInstructions?: string | null;
    imageStyle?: string | null;
  };
};

export type BrandDNAGenerationContext = {
  site: {
    name: string;
    domain: string;
    contentLanguage?: string | null;
  };
  businessDescription?: string;
};

export type ArticleCoverImageGenerationContext = {
  article: {
    id: string;
    title: string;
    excerpt?: string | null;
  };
  site: {
    id: string;
    name: string;
    domain: string;
  };
  brandProfile: {
    contentLanguage?: string | null;
    businessType?: string | null;
    brandVoiceTone?: string | null;
    targetAudience?: string | null;
    serviceArea?: string | null;
    topicsToAvoid?: string | null;
    keyThemes?: string | null;
    customImageInstructions?: string | null;
    imageStyle?: string | null;
  };
};

export type GeneratedCoverImageAsset = {
  data: Buffer;
  mimeType: string;
  extension: string;
};

export interface AIGenerationService {
  generateArticle(context: ArticleGenerationContext): Promise<GeneratedArticleInput>;
  generateBrandDNA(context: BrandDNAGenerationContext): Promise<GeneratedBrandDNAInput>;
}

export interface AIImageGenerationService {
  generateArticleCoverImage(context: ArticleCoverImageGenerationContext): Promise<GeneratedCoverImageAsset>;
}
