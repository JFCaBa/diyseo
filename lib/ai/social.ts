import { ZodError } from "zod";

import { buildSocialPostsSystemPrompt, buildSocialPostsUserPrompt } from "@/lib/ai/prompts";
import type { SocialPostsGenerationContext } from "@/lib/ai/types";
import { GeneratedSocialPostsSchema, type GeneratedSocialPosts } from "@/lib/validations";

type RequestJson = (systemText: string, userText: string) => Promise<unknown>;

/** Asks for the four posts; an answer that breaks a limit is retried once with what was wrong. */
export async function requestSocialPosts(requestJson: RequestJson, context: SocialPostsGenerationContext): Promise<GeneratedSocialPosts> {
  const system = buildSocialPostsSystemPrompt(context);
  const user = buildSocialPostsUserPrompt(context);
  const first = GeneratedSocialPostsSchema.safeParse(await requestJson(system, user));
  if (first.success) return first.data;
  const issues = first.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  const second = await requestJson(system, `${user}\n\nYour JSON was invalid: ${issues}. Return the corrected JSON only.`);
  const parsed = GeneratedSocialPostsSchema.safeParse(second);
  if (!parsed.success) throw new ZodError(parsed.error.issues);
  return parsed.data;
}
