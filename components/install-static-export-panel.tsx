"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const host = formatSiteHost(siteDomain);
  const exportedLabel = staticExportedAt
    ? new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(
        new Date(staticExportedAt)
      )
    : null;

  async function download() {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/internal/sites/${encodeURIComponent(siteId)}/export`, { method: "POST" });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "The export failed. Try again.");
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
      setError("The export failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-line bg-white/90 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h4 className="text-sm font-semibold text-ink">Static export</h4>
          <p className="mt-1 text-sm text-slate-600">
            Download the blog as plain HTML files and upload them to your hosting. No server setup needed, which makes it the
            right choice when you cannot change your server configuration.
          </p>
        </div>
        <button
          type="button"
          onClick={download}
          disabled={busy}
          className="inline-flex shrink-0 items-center justify-center rounded-2xl border border-line px-4 py-3 text-sm font-semibold text-ink transition hover:bg-mist disabled:opacity-60"
        >
          {busy ? "Building ZIP…" : "Download ZIP"}
        </button>
      </div>

      <ol className="mt-4 grid gap-2 text-sm text-slate-600">
        <li>1. Download the ZIP and unzip it.</li>
        <li>
          2. Upload the <code>blog</code> folder (if you uploaded an earlier export, delete the old folder first, so unpublished or renamed
          articles do not stay online) to the root of your website, so <code>https://{host}/blog/</code> shows the blog.
        </li>
        <li>
          3. Submit <code>https://{host}/blog/sitemap.xml</code> in Google Search Console.
        </li>
      </ol>

      <p className="mt-4 text-xs text-slate-500">
        It is a snapshot: it does not update by itself. Download and upload it again after publishing new articles. Only the default
        language is included.
      </p>

      <div className="mt-4 rounded-2xl border border-line bg-mist/60 p-4 text-sm">
        {exportedLabel ? (
          <p className="text-slate-600">
            Last export: {exportedLabel} ({staticExportedCount ?? 0} articles).{" "}
            {changedSinceExport ? (
              <span className="font-semibold text-amber-700">Your articles changed since then. Download a new ZIP.</span>
            ) : (
              <span className="font-semibold text-accent">Up to date.</span>
            )}
          </p>
        ) : (
          <p className="text-slate-600">
            Not exported yet.{" "}
            {changedSinceExport ? <span className="font-semibold text-amber-700">You have published articles to export.</span> : null}
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
