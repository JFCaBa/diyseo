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

/** A reason a post cannot be saved, posted or shared. `limit` is set for "textTooLong". */
export type Blocker = {
  code:
    | "textEmpty"
    | "textTooLong"
    | "instagramHashtags"
    | "openNetwork"
    | "publishArticleFirst"
    | "alreadyPublished"
    | "publishing"
    | "connectPage"
    | "noInstagram"
    | "needsCover";
  limit?: number;
};

/** The English text of a blocker (what the plain-string helpers below return). */
export function blockerMessage(blocker: Blocker): string {
  switch (blocker.code) {
    case "textEmpty":
      return "Text is empty";
    case "textTooLong":
      return `Text is over the ${blocker.limit}-character limit`;
    case "instagramHashtags":
      return "Instagram allows at most 30 hashtags";
    case "openNetwork":
      return "Open the network to post";
    case "publishArticleFirst":
      return "Publish the article first";
    case "alreadyPublished":
      return "Already published";
    case "publishing":
      return "Publishing in progress";
    case "connectPage":
      return "Connect a Facebook Page in site settings";
    case "noInstagram":
      return "No Instagram account is linked to the Page";
    case "needsCover":
      return "Instagram needs a cover image stored in DIYSEO";
  }
}

/** Prefix of the error stored on a post whose publish result is not known. */
export const UNKNOWN_RESULT_PREFIX = "Unknown result: ";

/** Why this text cannot be saved or posted on this network, or null. */
export function textBlockerFor(network: SocialNetwork, text: string): Blocker | null {
  const t = text.trim();
  if (!t) return { code: "textEmpty" };
  if (t.length > SOCIAL_LIMITS[network]) return { code: "textTooLong", limit: SOCIAL_LIMITS[network] };
  if (network === "INSTAGRAM" && countHashtags(t) > INSTAGRAM_MAX_HASHTAGS) return { code: "instagramHashtags" };
  return null;
}

export function textBlocker(network: SocialNetwork, text: string): string | null {
  const blocker = textBlockerFor(network, text);
  return blocker ? blockerMessage(blocker) : null;
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
export function publishBlockerFor(c: PublishCheck): Blocker | null {
  if (c.network === "X" || c.network === "LINKEDIN") return { code: "openNetwork" };
  if (c.articleStatus !== "PUBLISHED") return { code: "publishArticleFirst" };
  if (c.status === "PUBLISHED") return { code: "alreadyPublished" };
  if (c.status === "PUBLISHING") return { code: "publishing" };
  const text = textBlockerFor(c.network, c.text);
  if (text) return text;
  if (!c.hasConnection) return { code: "connectPage" };
  if (c.network === "INSTAGRAM" && !c.hasInstagram) return { code: "noInstagram" };
  if (c.network === "INSTAGRAM" && !c.hasCover) return { code: "needsCover" };
  return null;
}

export function publishBlocker(c: PublishCheck): string | null {
  const blocker = publishBlockerFor(c);
  return blocker ? blockerMessage(blocker) : null;
}

/** Why an X or LinkedIn draft cannot be shared yet (its link would not work, or the network would cut it), or null. */
export function shareBlockerFor(c: { network: SocialNetwork; text: string; articleStatus: ArticleStatus }): Blocker | null {
  if (c.articleStatus !== "PUBLISHED") return { code: "publishArticleFirst" };
  return textBlockerFor(c.network, c.text);
}

export function shareBlocker(c: { network: SocialNetwork; text: string; articleStatus: ArticleStatus }): string | null {
  const blocker = shareBlockerFor(c);
  return blocker ? blockerMessage(blocker) : null;
}
