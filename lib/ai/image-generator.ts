import { QwenImageGenerator } from "@/lib/ai/qwen-image-generator";
import type { AIImageGenerationService, ArticleCoverImageGenerationContext } from "@/lib/ai/types";

export function getAIImageGenerationService(): AIImageGenerationService {
  const provider = (process.env.IMAGE_PROVIDER || "qwen").trim().toLowerCase();

  switch (provider) {
    case "qwen":
      return new QwenImageGenerator();
    default:
      throw new Error(`Unsupported image provider: ${provider}`);
  }
}

export function generateArticleCoverImage(context: ArticleCoverImageGenerationContext) {
  return getAIImageGenerationService().generateArticleCoverImage(context);
}
