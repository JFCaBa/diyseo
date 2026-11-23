"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";

import { InstallReverseProxyPanel } from "@/components/install-reverse-proxy-panel";
import { InstallStaticExportPanel } from "@/components/install-static-export-panel";
import { useLocale, useLocalizeMessage, useT } from "@/components/i18n-provider";
import { updateWidgetInstalledState, updateWidgetTheme, type ActionState } from "@/lib/actions";
import { formatDate } from "@/lib/i18n/translate";

type WidgetTheme = "light" | "dark";

// Latest-release asset published by .github/workflows/plugin-release.yml. The
// default points at this public repo; override with NEXT_PUBLIC_PLUGIN_DOWNLOAD_URL
// for forks, org migrations, or self-hosted deployments.
const PLUGIN_DOWNLOAD_URL =
  process.env.NEXT_PUBLIC_PLUGIN_DOWNLOAD_URL ??
  "https://github.com/JFCaBa/diyseo/releases/latest/download/diyseo-sync.zip";

type WidgetInstallCardProps = {
  baseUrl: string;
  siteId: string;
  siteDomain?: string | null;
  initialTheme?: WidgetTheme | null;
  widgetInstalledAt?: string | null;
  proxyVerifiedAt?: string | null;
  staticExportedAt?: string | null;
  staticExportedCount?: number | null;
  changedSinceExport?: boolean;
  id?: string;
};

const initialState: ActionState = {};

type InstallMethod = "proxy" | "static";

export function WidgetInstallCard({
  baseUrl,
  siteId,
  siteDomain,
  initialTheme,
  widgetInstalledAt,
  proxyVerifiedAt,
  staticExportedAt,
  staticExportedCount,
  changedSinceExport = false,
  id
}: WidgetInstallCardProps) {
  const t = useT();
  const locale = useLocale();
  const localizeMessage = useLocalizeMessage();
  const [method, setMethod] = useState<InstallMethod>(staticExportedAt && !proxyVerifiedAt ? "static" : "proxy");
  const [copiedField, setCopiedField] = useState<string | null>(null);
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
    ? formatDate(widgetInstalledAt, locale, {
        year: "numeric",
        month: "long",
        day: "numeric"
      })
    : null;

  useEffect(() => {
    setTheme(initialTheme === "dark" ? "dark" : "light");
  }, [initialTheme]);

  async function copyField(field: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      window.setTimeout(() => setCopiedField((current) => (current === field ? null : current)), 2000);
    } catch {
      setCopiedField(null);
    }
  }

  return (
    <section id={id} className="rounded-3xl border border-line bg-white/90 p-6 shadow-panel scroll-mt-24">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink">{t("install.card.title")}</h2>
          <p className="mt-1 text-sm text-slate-600">
            {t("install.card.intro")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => copyField("snippet", snippet)}
          className="inline-flex items-center justify-center rounded-2xl border border-line px-4 py-3 text-sm font-semibold text-ink transition hover:bg-mist"
        >
          {copiedField === "snippet" ? t("install.card.copied") : t("install.card.copySnippet")}
        </button>
      </div>

      <form ref={formRef} action={formAction} className="mt-6 grid gap-2">
        <label htmlFor="widgetTheme" className="text-sm font-medium text-ink">
          {t("install.card.widgetTheme")}
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
          <option value="light">{t("install.card.light")}</option>
          <option value="dark">{t("install.card.dark")}</option>
        </select>
        <p className="text-xs text-slate-500">{t("install.card.themeHint")}</p>
        {state.error ? <p className="text-xs text-red-600">{localizeMessage(state.error)}</p> : null}
        {!state.error && state.success ? <p className="text-xs text-accent">{localizeMessage(state.success)}</p> : null}
      </form>

      <div className="mt-6 rounded-2xl border border-line bg-mist/50 p-4">
        <div>
          <h3 className="text-sm font-semibold text-ink">{t("install.card.seoAttribution")}</h3>
          <p className="mt-1 text-sm text-slate-600">{t("install.card.seoAttributionIntro")}</p>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-line bg-white/90 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-ink">{t("install.card.simpleInstall")}</p>
              <span className="rounded-full bg-accent/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
                {t("install.card.availableNow")}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-600">{t("install.card.simpleInstallBody")}</p>
            <p className="mt-2 text-xs text-slate-500">{t("install.card.simpleInstallNote")}</p>
          </div>

          <div className="rounded-2xl border border-dashed border-line bg-white/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-ink">{t("install.card.seoOptimized")}</p>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {t("install.card.advanced")}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              {t("install.card.seoOptimizedBody")}
            </p>
            <p className="mt-2 text-xs text-slate-500">{t("install.card.seoOptimizedNote")}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2" role="tablist" aria-label={t("install.card.methodAria")}>
          {(
            [
              { id: "proxy", title: t("install.card.proxyTitle"), text: t("install.card.proxyText"), done: Boolean(proxyVerifiedAt) },
              { id: "static", title: t("install.card.staticTitle"), text: t("install.card.staticText"), done: Boolean(staticExportedAt) }
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={method === item.id}
              onClick={() => setMethod(item.id)}
              className={`rounded-2xl border p-4 text-left transition ${
                method === item.id ? "border-accent bg-white shadow-sm" : "border-dashed border-line bg-white/60 hover:bg-white"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-ink">{item.title}</p>
                {item.done ? (
                  <span className="rounded-full bg-accent/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
                    {item.id === "proxy" ? t("install.card.verified") : t("install.card.exported")}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-slate-500">{item.text}</p>
            </button>
          ))}
        </div>

        {method === "proxy" ? (
          <InstallReverseProxyPanel baseUrl={baseUrl} siteId={siteId} siteDomain={siteDomain} proxyVerifiedAt={proxyVerifiedAt} />
        ) : (
          <InstallStaticExportPanel
            siteId={siteId}
            siteDomain={siteDomain}
            staticExportedAt={staticExportedAt}
            staticExportedCount={staticExportedCount}
            changedSinceExport={changedSinceExport}
          />
        )}

        <div className="mt-4 rounded-2xl border border-line bg-white/90 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h4 className="text-sm font-semibold text-ink">{t("install.card.wordpressTitle")}</h4>
              <p className="mt-1 text-sm text-slate-600">
                {t("install.card.wordpressBody")}
              </p>
            </div>
            <a
              href={PLUGIN_DOWNLOAD_URL}
              className="inline-flex items-center justify-center rounded-2xl border border-line px-4 py-3 text-sm font-semibold text-ink transition hover:bg-mist"
            >
              {t("install.card.downloadPlugin")}
            </a>
          </div>

          <dl className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
            <div>
              <dt className="font-semibold text-ink">{t("install.card.baseUrl")}</dt>
              <dd className="mt-1 flex items-center gap-2">
                <span className="break-all">{baseUrl}</span>
                <button
                  type="button"
                  onClick={() => copyField("baseUrl", baseUrl)}
                  className="shrink-0 rounded-xl border border-line bg-white px-2.5 py-1 text-xs font-semibold text-ink transition hover:bg-mist"
                >
                  {copiedField === "baseUrl" ? t("install.card.copied") : t("install.card.copy")}
                </button>
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-ink">{t("install.card.siteId")}</dt>
              <dd className="mt-1 flex items-center gap-2">
                <span className="break-all">{siteId}</span>
                <button
                  type="button"
                  onClick={() => copyField("siteId", siteId)}
                  className="shrink-0 rounded-xl border border-line bg-white px-2.5 py-1 text-xs font-semibold text-ink transition hover:bg-mist"
                >
                  {copiedField === "siteId" ? t("install.card.copied") : t("install.card.copy")}
                </button>
              </dd>
            </div>
          </dl>

          <ol className="mt-4 grid gap-2 text-sm text-slate-600">
            <li>{t("install.card.wpStep1")}</li>
            <li>{t("install.card.wpStep2")}</li>
            <li>{t("install.card.wpStep3")}</li>
            <li>
              {t("install.card.wpStep4Before")}{" "}
              <Link
                href={`/${encodeURIComponent(siteId)}/api`}
                className="font-semibold text-accent underline-offset-2 hover:underline"
              >
                {t("install.card.wpStep4Link")}
              </Link>{" "}
              {t("install.card.wpStep4After")}
            </li>
            <li>{t("install.card.wpStep5")}</li>
          </ol>
        </div>
      </div>

      <dl className="mt-6 grid gap-3 text-sm text-slate-600 md:grid-cols-4">
        <div>
          <dt className="font-semibold text-ink">{t("install.card.embedUrl")}</dt>
          <dd className="mt-1 break-all">{embedUrl}</dd>
        </div>
        <div>
          <dt className="font-semibold text-ink">{"data-site"}</dt>
          <dd className="mt-1 break-all">{siteId}</dd>
        </div>
        <div>
          <dt className="font-semibold text-ink">{"data-base-path"}</dt>
          <dd className="mt-1">{"/blog"}</dd>
        </div>
        <div>
          <dt className="font-semibold text-ink">{"data-theme"}</dt>
          <dd className="mt-1">{theme}</dd>
        </div>
      </dl>

      <pre className="mt-6 overflow-x-auto rounded-2xl border border-line bg-sand/70 p-4 text-sm text-ink">
        <code>{snippet}</code>
      </pre>

      <div className="mt-6 rounded-2xl border border-line bg-mist/60 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-ink">{widgetInstalledAt ? t("install.card.widgetInstalled") : t("install.card.installationStatus")}</p>
            <p className="mt-1 text-sm text-slate-600">
              {widgetInstalledAt
                ? t("install.card.markedInstalled", { date: installedDateLabel ?? "" })
                : t("install.card.markInstalledHint")}
            </p>
          </div>
          <form action={installFormAction}>
            <input type="hidden" name="installed" value={widgetInstalledAt ? "false" : "true"} />
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-2xl border border-line px-4 py-3 text-sm font-semibold text-ink transition hover:bg-white"
            >
              {widgetInstalledAt ? t("install.card.markNotInstalled") : t("install.card.markInstalled")}
            </button>
          </form>
        </div>
        {installState.error ? <p className="mt-3 text-xs text-red-600">{localizeMessage(installState.error)}</p> : null}
        {!installState.error && installState.success ? <p className="mt-3 text-xs text-accent">{localizeMessage(installState.success)}</p> : null}
      </div>
    </section>
  );
}
