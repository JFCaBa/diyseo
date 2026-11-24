import { ProviderHttpError } from "@/lib/provider-error";
import type { LocalizeMessage, T } from "@/lib/i18n/translate";

const KEYS = {
  googleRefresh: "analytics.errGoogleRefresh",
  sitesList: "analytics.errSitesList",
  searchAnalyticsQuery: "analytics.errQuery",
  serperSearch: "analytics.errSerper"
} as const;

/** Text for an error from the Search Console / Serper libs. Selects by error class and code, never by message text. */
export function localizeProviderError(t: T, localizeMessage: LocalizeMessage, error: unknown, fallback: string): string {
  if (error instanceof ProviderHttpError) {
    return t(KEYS[error.code], { status: error.status, detail: error.detail });
  }
  return error instanceof Error ? localizeMessage(error.message) : fallback;
}
