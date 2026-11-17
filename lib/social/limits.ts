import type { SocialNetwork } from "@prisma/client";

/** Maximum characters per network (the X link is appended separately and counts as 23 there). */
export const SOCIAL_LIMITS: Record<SocialNetwork, number> = { FACEBOOK: 1500, INSTAGRAM: 2000, X: 250, LINKEDIN: 1800 };

export const SOCIAL_NETWORKS: SocialNetwork[] = ["FACEBOOK", "INSTAGRAM", "X", "LINKEDIN"];

/** Keys of the AI output, per network. */
export const GENERATED_KEY: Record<SocialNetwork, "facebook" | "instagram" | "x" | "linkedin"> = {
  FACEBOOK: "facebook",
  INSTAGRAM: "instagram",
  X: "x",
  LINKEDIN: "linkedin"
};

export function countHashtags(text: string): number {
  return (text.match(/#[\p{L}\p{N}_]+/gu) ?? []).length;
}
