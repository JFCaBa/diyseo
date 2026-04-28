import { buildArticleTranslationSystemPrompt, buildArticleTranslationUserPrompt } from "@/lib/ai/prompts";
import { GeneratedArticleTranslationSchema } from "@/lib/validations";

type DeepSeekResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

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

function normalizeJsonText(value: string) {
  return value.replace(/^```json\s*/i, "").replace(/\s*```$/, "").trim();
}

function extractGeminiJsonText(payload: GeminiResponse) {
  const text =
    payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim() ?? "";

  return normalizeJsonText(text);
}

async function requestDeepSeekJson(systemText: string, userText: string) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const baseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
  const model = process.env.DEEPSEEK_MODEL || process.env.DEEPSEEK_API_MODEL || "deepseek-chat";

  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is not configured.");
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
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

async function requestGeminiJson(systemText: string, userText: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

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
          temperature: 0.4,
          responseMimeType: "application/json"
        }
      })
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini request failed: ${response.status} ${errorText}`);
  }

  return JSON.parse(extractGeminiJsonText((await response.json()) as GeminiResponse));
}

export async function generateArticleTranslation(input: {
  title: string;
  excerpt?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  contentMarkdown: string;
  language: string;
}) {
  const provider = process.env.AI_PROVIDER || "gemini";
  const systemText = buildArticleTranslationSystemPrompt(input.language);
  const userText = buildArticleTranslationUserPrompt(input);

  const payload =
    provider === "deepseek"
      ? await requestDeepSeekJson(systemText, userText)
      : provider === "gemini"
        ? await requestGeminiJson(systemText, userText)
        : (() => {
            throw new Error(`Unsupported AI provider: ${provider}`);
          })();

  return GeneratedArticleTranslationSchema.parse(payload);
}
