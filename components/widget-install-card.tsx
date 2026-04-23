"use client";

import { useState } from "react";

type WidgetInstallCardProps = {
  baseUrl: string;
  siteId: string;
  id?: string;
};

export function WidgetInstallCard({ baseUrl, siteId, id }: WidgetInstallCardProps) {
  const [copied, setCopied] = useState(false);
  const embedUrl = `${baseUrl}/embed.js`;
  const snippet = `<div id="soro-widget-container"></div>
<script
  src="${embedUrl}"
  data-site="${siteId}"
  data-base-path="/blog"
></script>`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section id={id} className="rounded-3xl border border-line bg-white/90 p-6 shadow-panel scroll-mt-24">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink">Install Widget</h2>
          <p className="mt-1 text-sm text-slate-600">
            Copy this snippet to embed the published article widget for this site.
          </p>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center justify-center rounded-2xl border border-line px-4 py-3 text-sm font-semibold text-ink transition hover:bg-mist"
        >
          {copied ? "Copied" : "Copy Snippet"}
        </button>
      </div>

      <dl className="mt-6 grid gap-3 text-sm text-slate-600 md:grid-cols-3">
        <div>
          <dt className="font-semibold text-ink">embed.js URL</dt>
          <dd className="mt-1 break-all">{embedUrl}</dd>
        </div>
        <div>
          <dt className="font-semibold text-ink">data-site</dt>
          <dd className="mt-1 break-all">{siteId}</dd>
        </div>
        <div>
          <dt className="font-semibold text-ink">data-base-path</dt>
          <dd className="mt-1">/blog</dd>
        </div>
      </dl>

      <pre className="mt-6 overflow-x-auto rounded-2xl border border-line bg-sand/70 p-4 text-sm text-ink">
        <code>{snippet}</code>
      </pre>
    </section>
  );
}
