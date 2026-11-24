import type { T } from "@/lib/i18n/translate";
import { UNKNOWN_RESULT_PREFIX, type Blocker } from "@/lib/social/rules";

/** A blocker in the UI language. The English output equals `blockerMessage(blocker)`. */
export function localizeBlocker(t: T, blocker: Blocker): string {
  switch (blocker.code) {
    case "textEmpty":
      return t("social.blocker.textEmpty");
    case "textTooLong":
      return t("social.blocker.textTooLong", { limit: blocker.limit ?? 0 });
    case "instagramHashtags":
      return t("social.blocker.instagramHashtags");
    case "openNetwork":
      return t("social.blocker.openNetwork");
    case "publishArticleFirst":
      return t("social.blocker.publishArticleFirst");
    case "alreadyPublished":
      return t("social.blocker.alreadyPublished");
    case "publishing":
      return t("social.blocker.publishing");
    case "connectPage":
      return t("social.blocker.connectPage");
    case "noInstagram":
      return t("social.blocker.noInstagram");
    case "needsCover":
      return t("social.blocker.needsCover");
  }
}

/**
 * A post's stored error text in the UI language. Our own static texts go through `localizeMessage`;
 * whatever Meta said stays verbatim, inside our wrapper for unknown results.
 */
export function localizeStoredPostError(t: T, localizeMessage: (message: string) => string, error: string): string {
  if (error.startsWith(UNKNOWN_RESULT_PREFIX)) {
    return t("social.unknownResult", { message: localizeMessage(error.slice(UNKNOWN_RESULT_PREFIX.length)) });
  }
  return localizeMessage(error);
}
