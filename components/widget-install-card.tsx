"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { updateWidgetInstalledState, updateWidgetTheme, type ActionState } from "@/lib/actions";

type WidgetTheme = "light" | "dark";

type WidgetInstallCardProps = {
  baseUrl: string;
  siteId: string;
  initialTheme?: WidgetTheme | null;
  widgetInstalledAt?: string | null;
  id?: string;
};

const initialState: ActionState = {};

export function WidgetInstallCard({ baseUrl, siteId, initialTheme, widgetInstalledAt, id }: WidgetInstallCardProps) {
  const [copied, setCopied] = useState(false);
  const [theme, setTheme] = useState<WidgetTheme>(initialTheme === "dark" ? "dark" : "light");
  const formRef = useRef<HTMLFormElement>(null);
  const updateWidgetThemeForSite = updateWidgetTheme.bind(null, siteId);
  const updateWidgetInstalledStateForSite = updateWidgetInstalledState.bind(null, siteId);
  const [state, formAction] = useActionState(updateWidgetThemeForSite, initialState);
  const [installState, installFormAction] = useActionState(updateWidgetInstalledStateForSite, initialState);
  const embedUrl = `${baseUrl}/embed.js`;
  const snippet = `<div id="soro-widget-container"></div>
<script
  src="${embedUrl}"
  data-site="${siteId}"
  data-base-path="/blog"
  data-theme="${theme}"
></script>`;
  const installedDateLabel = widgetInstalledAt
    ? new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric"
      }).format(new Date(widgetInstalledAt))
    : null;

  useEffect(() => {
    setTheme(initialTheme === "dark" ? "dark" : "light");
  }, [initialTheme]);

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
            Choose a theme, then copy this snippet to embed the published article widget for this site.
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

      <form ref={formRef} action={formAction} className="mt-6 grid gap-2">
        <label htmlFor="widgetTheme" className="text-sm font-medium text-ink">
          Widget theme
        </label>
        <select
          id="widgetTheme"
          name="widgetTheme"
          value={theme}
          onChange={(event) => {
            const nextTheme = event.target.value === "dark" ? "dark" : "light";
            setTheme(nextTheme);
            formRef.current?.requestSubmit();
          }}
          className="w-full max-w-xs rounded-2xl border border-line bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-accent"
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
        <p className="text-xs text-slate-500">Default is Light. Change this if the host site uses a dark visual theme.</p>
        {state.error ? <p className="text-xs text-red-600">{state.error}</p> : null}
        {!state.error && state.success ? <p className="text-xs text-accent">{state.success}</p> : null}
      </form>

      <dl className="mt-6 grid gap-3 text-sm text-slate-600 md:grid-cols-4">
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
        <div>
          <dt className="font-semibold text-ink">data-theme</dt>
          <dd className="mt-1">{theme}</dd>
        </div>
      </dl>

      <pre className="mt-6 overflow-x-auto rounded-2xl border border-line bg-sand/70 p-4 text-sm text-ink">
        <code>{snippet}</code>
      </pre>

      <div className="mt-6 rounded-2xl border border-line bg-mist/60 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-ink">{widgetInstalledAt ? "Widget installed" : "Installation status"}</p>
            <p className="mt-1 text-sm text-slate-600">
              {widgetInstalledAt
                ? `Marked installed on ${installedDateLabel}.`
                : "Mark this complete after you place the snippet on your website."}
            </p>
          </div>
          <form action={installFormAction}>
            <input type="hidden" name="installed" value={widgetInstalledAt ? "false" : "true"} />
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-2xl border border-line px-4 py-3 text-sm font-semibold text-ink transition hover:bg-white"
            >
              {widgetInstalledAt ? "Mark as not installed" : "Mark as installed"}
            </button>
          </form>
        </div>
        {installState.error ? <p className="mt-3 text-xs text-red-600">{installState.error}</p> : null}
        {!installState.error && installState.success ? <p className="mt-3 text-xs text-accent">{installState.success}</p> : null}
      </div>
    </section>
  );
}
