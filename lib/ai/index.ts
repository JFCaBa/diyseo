import { DeepSeekGenerator } from "@/lib/ai/deepseek-generator";
import { GeminiGenerator } from "@/lib/ai/gemini-generator";
import type { AIGenerationService } from "@/lib/ai/types";

export function getAIGenerationService(): AIGenerationService {
  const provider = process.env.AI_PROVIDER || "gemini";

  switch (provider) {
    case "deepseek":
      return new DeepSeekGenerator();
    case "gemini":
      return new GeminiGenerator();
    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
}
