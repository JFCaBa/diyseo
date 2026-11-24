import { QuotaError } from "@/lib/quota-error";
import type { LocalizeMessage, T } from "@/lib/i18n/translate";

/** Text for a QuotaError. Selects by `code` and `vars`, never by message text. Other errors go through `localizeMessage`. */
export function localizeQuotaError(t: T, localizeMessage: LocalizeMessage, error: unknown): string {
  if (!(error instanceof QuotaError)) return error instanceof Error ? localizeMessage(error.message) : "";
  const plan = error.vars.plan ?? "";
  const limit = error.vars.limit ?? 0;

  switch (error.code) {
    case "trialEndedArticles":
      return t("quota.trialEndedArticles");
    case "articlesExhausted":
      return t("quota.articlesExhausted", { limit, plan });
    case "translationsNotIncluded":
      return t("quota.translationsNotIncluded");
    case "trialEndedSites":
      return t("quota.trialEndedSites");
    case "sitesLimit":
      return t(limit === 1 ? "quota.sitesLimitOne" : "quota.sitesLimitOther", { limit, plan });
  }
}
