import { GeneratedArticleSchema, GeneratedBrandDNASchema } from "@/lib/validations";
import {
  buildBrandDNASystemPrompt,
  buildBrandDNAUserPrompt,
  buildSystemPrompt,
  buildUserPrompt
} from "@/lib/ai/prompts";
import type { AIGenerationService, ArticleGenerationContext, BrandDNAGenerationContext } from "@/lib/ai/types";

type DeepSeekResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

function normalizeJsonText(value: string) {
  return value.replace(/^```json\s*/i, "").replace(/\s*```$/, "").trim();
}

export class DeepSeekGenerator implements AIGenerationService {
  private getConfig() {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    const baseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
    const model = process.env.DEEPSEEK_MODEL || process.env.DEEPSEEK_API_MODEL || "deepseek-chat";

    if (!apiKey) {
      throw new Error("DEEPSEEK_API_KEY is not configured.");
    }

    return { apiKey, baseUrl, model };
  }

  private async requestJson(systemText: string, userText: string) {
    const { apiKey, baseUrl, model } = this.getConfig();

    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: 0.7,
        response_format: {
          type: "json_object"
        },
        messages: [
          {
            role: "system",
            content: systemText
          },
          {
            role: "user",
            content: userText
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepSeek request failed: ${response.status} ${errorText}`);
    }

    const payload = (await response.json()) as DeepSeekResponse;
    const text = payload.choices?.[0]?.message?.content?.trim();

    if (!text) {
      throw new Error("DeepSeek returned an empty response.");
    }

    return JSON.parse(normalizeJsonText(text));
  }

  async generateArticle(context: ArticleGenerationContext) {
    return GeneratedArticleSchema.parse(await this.requestJson(buildSystemPrompt(context), buildUserPrompt(context)));
  }

  async generateBrandDNA(context: BrandDNAGenerationContext) {
    return GeneratedBrandDNASchema.parse(
      await this.requestJson(buildBrandDNASystemPrompt(), buildBrandDNAUserPrompt(context))
    );
  }
}
