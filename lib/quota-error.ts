export type QuotaErrorCode = "trialEndedArticles" | "articlesExhausted" | "translationsNotIncluded" | "trialEndedSites" | "sitesLimit";

/** A limit that blocks the action. `message` is the English text; `code`/`vars` let the UI translate it. */
export class QuotaError extends Error {
  constructor(
    message: string,
    readonly code: QuotaErrorCode,
    readonly vars: { plan?: string; limit?: number } = {}
  ) {
    super(message);
    this.name = "QuotaError";
  }
}

export function isQuotaError(error: unknown): error is QuotaError {
  return error instanceof QuotaError;
}
