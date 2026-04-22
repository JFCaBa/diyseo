import { GeneratedArticleSchema, GeneratedBrandDNASchema } from "@/lib/validations";
import {
  buildBrandDNASystemPrompt,
  buildBrandDNAUserPrompt,
  buildSystemPrompt,
  buildUserPrompt
} from "@/lib/ai/prompts";
import type { AIGenerationService, ArticleGenerationContext, BrandDNAGenerationContext } from "@/lib/ai/types";

type GeminiCandidatePart = {
  text?: string;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: GeminiCandidatePart[];
    };
  }>;
};

function extractJsonText(payload: GeminiResponse) {
  const text =
    payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim() ?? "";

  return text.replace(/^```json\s*/i, "").replace(/\s*```$/, "").trim();
}

export class GeminiGenerator implements AIGenerationService {
  private getConfig() {
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";

    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured.");
    }

    return { apiKey, model };
  }

  private async requestJson(systemText: string, userText: string) {
    const { apiKey, model } = this.getConfig();

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: userText
                }
              ]
            }
          ],
          systemInstruction: {
            parts: [
              {
                text: systemText
              }
            ]
          },
          generationConfig: {
            temperature: 0.7,
            responseMimeType: "application/json"
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini request failed: ${response.status} ${errorText}`);
    }

    const payload = (await response.json()) as GeminiResponse;
    return JSON.parse(extractJsonText(payload));
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
