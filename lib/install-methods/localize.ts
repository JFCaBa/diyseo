import type { ExportError } from "@/lib/install-methods/static-export";
import type { ProxyResult } from "@/lib/install-methods/verify-proxy";
import type { T } from "@/lib/i18n/translate";

/** Localized text for a proxy check. Selects by `result.reason`, never by matching the English message. */
export function localizeProxyResult(t: T, result: ProxyResult, host: string): string {
  if (result.ok) return t("install.verifyResult.ok", { host });

  switch (result.reason) {
    case "invalid_host":
      return t("install.verifyResult.invalidHost");
    case "unreachable":
      return t("install.verifyResult.unreachable", { host });
    case "not_found":
      return t("install.verifyResult.notFound", { host });
    case "redirect":
      return t("install.verifyResult.redirect", { host });
    case "bad_status":
      return result.status === undefined ? result.message : t("install.verifyResult.badStatus", { host, status: result.status });
    case "not_diyseo":
      return t("install.verifyResult.notDiyseo", { host });
    case "wrong_site":
      return t("install.verifyResult.wrongSite");
    case "forwarded_host_missing":
      return t("install.verifyResult.forwardedHostMissing");
  }
}

/** Localized text for an ExportError, selected by its `code`. Falls back to the English message. */
export function localizeExportError(t: T, error: Pick<ExportError, "message" | "code" | "vars" | "proxy">): string {
  const vars = error.vars ?? {};

  switch (error.code) {
    case "pageTooLarge":
      return t("install.exportResult.pageTooLarge");
    case "tooManyArticles":
      return t("install.exportResult.tooManyArticles", vars);
    case "badSlug":
      return t("install.exportResult.badSlug", vars);
    case "tooSlow":
      return t("install.exportResult.tooSlow");
    case "renderFailed":
      return t("install.exportResult.renderFailed");
    case "pageStatus":
      return t("install.exportResult.pageStatus", vars);
    case "tooLarge":
      return t("install.exportResult.tooLarge");
    case "blogNotRendered":
      return error.proxy
        ? t("install.exportResult.blogNotRendered", { host: String(vars.host ?? ""), reason: localizeProxyResult(t, error.proxy, String(vars.host ?? "")) })
        : error.message;
    case "foreignStylesheet":
      return t("install.exportResult.foreignStylesheet");
    case "stillDiyseo":
      return t("install.exportResult.stillDiyseo");
    default:
      return error.message;
  }
}
