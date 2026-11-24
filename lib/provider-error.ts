export type ProviderErrorCode = "googleRefresh" | "sitesList" | "searchAnalyticsQuery" | "serperSearch";

/** An upstream HTTP failure. `message` is the English text shown today; `code`/`status`/`detail` let the UI translate it. */
export class ProviderHttpError extends Error {
  constructor(
    readonly code: ProviderErrorCode,
    readonly status: number,
    readonly detail: string,
    message: string
  ) {
    super(message);
    this.name = "ProviderHttpError";
  }
}
