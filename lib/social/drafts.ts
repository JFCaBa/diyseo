import type { SocialNetwork, SocialPostStatus } from "@prisma/client";

import { GENERATED_KEY, SOCIAL_NETWORKS } from "@/lib/social/limits";
import type { GeneratedSocialPosts } from "@/lib/validations";

/** The drafts to write: every network whose post is not being published or already published. */
export function mergeDrafts(
  existing: { network: SocialNetwork; status: SocialPostStatus }[],
  generated: GeneratedSocialPosts
): { network: SocialNetwork; text: string }[] {
  const locked = new Set(existing.filter((p) => p.status === "PUBLISHED" || p.status === "PUBLISHING").map((p) => p.network));
  return SOCIAL_NETWORKS.filter((n) => !locked.has(n)).map((network) => ({ network, text: generated[GENERATED_KEY[network]] }));
}

const ARTICLE_TEXT_MAX = 12_000;

/** What the AI reads: the Markdown, or the HTML as plain text when there is no Markdown; capped at 12,000 characters. */
export function articleText(markdown: string | null, html: string): string {
  const text = markdown?.trim() ? markdown : html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text.slice(0, ARTICLE_TEXT_MAX);
}
