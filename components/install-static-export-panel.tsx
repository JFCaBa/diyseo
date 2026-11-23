"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useLocale, useT } from "@/components/i18n-provider";
import { formatDate } from "@/lib/i18n/translate";
import { formatSiteHost } from "@/lib/install-methods/site-host";

type InstallStaticExportPanelProps = {
  siteId: string;
  siteDomain?: string | null;
  staticExportedAt?: string | null;
  staticExportedCount?: number | null;
  changedSinceExport: boolean;
};

export function InstallStaticExportPanel({
  siteId,
  siteDomain,
  staticExportedAt,
  staticExportedCount,
  changedSinceExport
}: InstallStaticExportPanelProps) {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const host = formatSiteHost(siteDomain);
  const exportedLabel = staticExportedAt
    ? formatDate(staticExportedAt, locale, { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : null;

  async function download() {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/internal/sites/${encodeURIComponent(siteId)}/export`, { method: "POST" });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? t("install.export.failed"));
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${host}-blog.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      router.refresh();
    } catch {
      setError(t("install.export.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-line bg-white/90 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h4 className="text-sm font-semibold text-ink">{t("install.export.title")}</h4>
          <p className="mt-1 text-sm text-slate-600">
            {t("install.export.body")}
          </p>
        </div>
        <button
          type="button"
          onClick={download}
          disabled={busy}
          className="inline-flex shrink-0 items-center justify-center rounded-2xl border border-line px-4 py-3 text-sm font-semibold text-ink transition hover:bg-mist disabled:opacity-60"
        >
          {busy ? t("install.export.building") : t("install.export.download")}
        </button>
      </div>

      <ol className="mt-4 grid gap-2 text-sm text-slate-600">
        <li>{t("install.export.step1")}</li>
        <li>
          {t("install.export.step2Before")} <code>blog</code> {t("install.export.step2Middle")} <code>https://{host}/blog/</code>{" "}
          {t("install.export.step2After")}
        </li>
        <li>
          {t("install.export.step3Before")} <code>https://{host}/blog/sitemap.xml</code> {t("install.export.step3After")}
        </li>
      </ol>

      <p className="mt-4 text-xs text-slate-500">
        {t("install.export.snapshot")}
      </p>

      <div className="mt-4 rounded-2xl border border-line bg-mist/60 p-4 text-sm">
        {exportedLabel ? (
          <p className="text-slate-600">
            {t((staticExportedCount ?? 0) === 1 ? "install.export.lastExportOne" : "install.export.lastExportOther", {
              date: exportedLabel,
              count: staticExportedCount ?? 0
            })}{" "}
            {changedSinceExport ? (
              <span className="font-semibold text-amber-700">{t("install.export.changed")}</span>
            ) : (
              <span className="font-semibold text-accent">{t("install.export.upToDate")}</span>
            )}
          </p>
        ) : (
          <p className="text-slate-600">
            {t("install.export.notExported")}{" "}
            {changedSinceExport ? <span className="font-semibold text-amber-700">{t("install.export.toExport")}</span> : null}
          </p>
        )}
        {error ? (
          <p className="mt-2 text-red-600" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
