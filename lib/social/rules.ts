import type { ArticleStatus, SocialNetwork, SocialPostStatus } from "@prisma/client";

import { SOCIAL_LIMITS, countHashtags } from "@/lib/social/limits";

/** A publish that has not reported back for this long is shown as "Unknown result: check the Page". */
export const UNKNOWN_AFTER_MS = 5 * 60_000;
const INSTAGRAM_MAX_HASHTAGS = 30;

export type EffectiveStatus = SocialPostStatus | "UNKNOWN";

/** PUBLISHING older than 5 minutes is UNKNOWN. Nothing is written for it: the user resolves it explicitly. */
export function effectiveStatus(p: { status: SocialPostStatus; updatedAt: Date }, now: Date): EffectiveStatus {
  return p.status === "PUBLISHING" && now.getTime() - p.updatedAt.getTime() > UNKNOWN_AFTER_MS ? "UNKNOWN" : p.status;
}

/** Why this text cannot be saved or posted on this network, or null. */
export function textBlocker(network: SocialNetwork, text: string): string | null {
  const t = text.trim();
  if (!t) return "Text is empty";
  if (t.length > SOCIAL_LIMITS[network]) return `Text is over the ${SOCIAL_LIMITS[network]}-character limit`;
  if (network === "INSTAGRAM" && countHashtags(t) > INSTAGRAM_MAX_HASHTAGS) return "Instagram allows at most 30 hashtags";
  return null;
}

export type PublishCheck = {
  network: SocialNetwork;
  text: string;
  status: SocialPostStatus;
  articleStatus: ArticleStatus;
  hasConnection: boolean;
  hasInstagram: boolean;
  /** The article has a cover stored in DIYSEO (the only kind the social image serves). */
  hasCover: boolean;
};

/** Why this post cannot be published through the API right now, or null. */
export function publishBlocker(c: PublishCheck): string | null {
  if (c.network === "X" || c.network === "LINKEDIN") return "Open the network to post";
  if (c.articleStatus !== "PUBLISHED") return "Publish the article first";
  if (c.status === "PUBLISHED") return "Already published";
  if (c.status === "PUBLISHING") return "Publishing in progress";
  const text = textBlocker(c.network, c.text);
  if (text) return text;
  if (!c.hasConnection) return "Connect a Facebook Page in site settings";
  if (c.network === "INSTAGRAM" && !c.hasInstagram) return "No Instagram account is linked to the Page";
  if (c.network === "INSTAGRAM" && !c.hasCover) return "Instagram needs a cover image stored in DIYSEO";
  return null;
}

/** Why an X or LinkedIn draft cannot be shared yet (its link would not work, or the network would cut it), or null. */
export function shareBlocker(c: { network: SocialNetwork; text: string; articleStatus: ArticleStatus }): string | null {
  if (c.articleStatus !== "PUBLISHED") return "Publish the article first";
  return textBlocker(c.network, c.text);
}
