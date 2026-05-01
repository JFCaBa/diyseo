import sharp from "sharp";

import { buildArticleCoverImageNegativePrompt, buildArticleCoverImagePrompt } from "@/lib/ai/prompts";
import type {
  AIImageGenerationService,
  ArticleCoverImageGenerationContext,
  GeneratedCoverImageAsset
} from "@/lib/ai/types";

type QwenImageResponse = {
  output?: {
    choices?: Array<{
      message?: {
        content?: Array<{
          image?: string;
        }>;
      };
    }>;
  };
  code?: string;
  message?: string;
  request_id?: string;
};

function normalizeBaseUrl(value: string) {
  return value.replace(/\/$/, "");
}

export class QwenImageGenerator implements AIImageGenerationService {
  private getConfig() {
    const apiKey = process.env.QWEN_API_KEY?.trim();
    const model = process.env.QWEN_IMAGE_MODEL?.trim() || "wan2.7-image";
    const baseUrl = normalizeBaseUrl(process.env.DASHSCOPE_BASE_URL?.trim() || "https://dashscope-intl.aliyuncs.com/api/v1");

    if (!apiKey) {
      throw new Error("QWEN_API_KEY is not configured.");
    }

    return { apiKey, model, baseUrl };
  }

  private async downloadGeneratedImage(imageUrl: string): Promise<GeneratedCoverImageAsset> {
    const response = await fetch(imageUrl, {
      headers: {
        Accept: "image/png,image/*;q=0.9,*/*;q=0.8"
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Qwen generated image download failed: ${response.status} ${errorText}`);
    }

    const mimeType = response.headers.get("content-type") || "image/png";

    if (!mimeType.startsWith("image/")) {
      throw new Error("Qwen returned a non-image response.");
    }

    const arrayBuffer = await response.arrayBuffer();
    const compressed = await sharp(Buffer.from(arrayBuffer)).webp({ quality: 80 }).toBuffer();

    return {
      data: compressed,
      mimeType: "image/webp",
      extension: "webp"
    };
  }

  async generateArticleCoverImage(context: ArticleCoverImageGenerationContext) {
    const { apiKey, model, baseUrl } = this.getConfig();

    const response = await fetch(`${baseUrl}/services/aigc/multimodal-generation/generation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        input: {
          messages: [
            {
              role: "user",
              content: [
                {
                  text: buildArticleCoverImagePrompt(context)
                }
              ]
            }
          ]
        },
        parameters: {
          negative_prompt: buildArticleCoverImageNegativePrompt(),
          prompt_extend: true,
          watermark: false,
          size: "768*768",
          n: 1
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Qwen image generation failed: ${response.status} ${errorText}`);
    }

    const payload = (await response.json()) as QwenImageResponse;
    const imageUrl = payload.output?.choices?.[0]?.message?.content?.find((item) => typeof item.image === "string")?.image;

    if (!imageUrl) {
      throw new Error(payload.message || "Qwen image generation did not return an image URL.");
    }

    return this.downloadGeneratedImage(imageUrl);
  }
}
