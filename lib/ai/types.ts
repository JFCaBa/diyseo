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

export interface AIGenerationService {
  generateArticle(context: ArticleGenerationContext): Promise<GeneratedArticleInput>;
  generateBrandDNA(context: BrandDNAGenerationContext): Promise<GeneratedBrandDNAInput>;
}
