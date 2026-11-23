"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useLocale, useT } from "@/components/i18n-provider";
import { formatDate } from "@/lib/i18n/translate";
import { buildApacheConfig, buildNginxConfig, buildWorkerScript } from "@/lib/install-methods/proxy-configs";
import { formatSiteHost } from "@/lib/install-methods/site-host";

type Platform = "cloudflare" | "nginx" | "apache";

type VerifyResult = { ok: boolean; message: string };

type InstallReverseProxyPanelProps = {
  baseUrl: string;
  siteId: string;
  siteDomain?: string | null;
  proxyVerifiedAt?: string | null;
};

const PLATFORMS: Array<{ id: Platform; label: string }> = [
  { id: "cloudflare", label: "Cloudflare" },
  { id: "nginx", label: "Nginx" },
  { id: "apache", label: "Apache" }
];

export function InstallReverseProxyPanel({ baseUrl, siteId, siteDomain, proxyVerifiedAt }: InstallReverseProxyPanelProps) {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const [platform, setPlatform] = useState<Platform>("cloudflare");
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const host = formatSiteHost(siteDomain);
  const route = `${host}/blog*`;
  const input = { origin: baseUrl, siteId };
  const config =
    platform === "cloudflare" ? buildWorkerScript(input) : platform === "nginx" ? buildNginxConfig(input) : buildApacheConfig(input);
  const fileLabel =
    platform === "cloudflare" ? t("install.proxy.workerScript") : platform === "nginx" ? t("install.proxy.nginxConfig") : t("install.proxy.apacheConfig");
  const verifiedLabel = proxyVerifiedAt ? formatDate(proxyVerifiedAt, locale, { year: "numeric", month: "long", day: "numeric" }) : null;

  async function copyConfig() {
    try {
      await navigator.clipboard.writeText(config);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function verify() {
    setChecking(true);
    setResult(null);

    try {
      const response = await fetch(`/api/internal/sites/${encodeURIComponent(siteId)}/verify-proxy`, { method: "POST" });
      const body = (await response.json().catch(() => null)) as VerifyResult | { error?: string } | null;

      if (body && "message" in body && typeof body.message === "string") {
        setResult({ ok: Boolean((body as VerifyResult).ok), message: body.message });

        if ((body as VerifyResult).ok) {
          router.refresh();
        }
      } else {
        setResult({ ok: false, message: (body as { error?: string } | null)?.error ?? t("install.proxy.checkFailed") });
      }
    } catch {
      setResult({ ok: false, message: t("install.proxy.checkFailed") });
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-line bg-white/90 p-4">
      <div>
        <h4 className="text-sm font-semibold text-ink">{t("install.proxy.title")}</h4>
        <p className="mt-1 text-sm text-slate-600">
          {t("install.proxy.descBefore")} <code>{host}/blog</code>
          {t("install.proxy.descAfter")}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label={t("install.proxy.platformAria")}>
        {PLATFORMS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={platform === item.id}
            onClick={() => setPlatform(item.id)}
            className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
              platform === item.id ? "border-accent bg-accent/10 text-accent" : "border-line bg-white text-ink hover:bg-mist"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <dl className="mt-4 grid gap-3 text-sm text-slate-600 md:grid-cols-3">
        <div>
          <dt className="font-semibold text-ink">{t("install.proxy.siteId")}</dt>
          <dd className="mt-1 break-all">{siteId}</dd>
        </div>
        <div>
          <dt className="font-semibold text-ink">{t("install.proxy.origin")}</dt>
          <dd className="mt-1 break-all">{baseUrl}</dd>
        </div>
        <div>
          <dt className="font-semibold text-ink">{platform === "cloudflare" ? t("install.proxy.recommendedRoute") : t("install.proxy.path")}</dt>
          <dd className="mt-1 break-all">{platform === "cloudflare" ? route : `${host}/blog`}</dd>
        </div>
      </dl>

      {platform === "cloudflare" ? (
        <>
          <p className="mt-4 text-xs font-medium text-slate-500">
            {t("install.proxy.cfNoteBefore")} <code>{route}</code> {t("install.proxy.cfNoteAfter")}
          </p>
          <ol className="mt-3 grid gap-2 text-sm text-slate-600">
            <li>{t("install.proxy.cf1")}</li>
            <li>
              {t("install.proxy.cf2Before")} <code>{route}</code> {t("install.proxy.cf2After")}
            </li>
            <li>{t("install.proxy.cf3")}</li>
            <li>{t("install.proxy.cf4")}</li>
          </ol>
        </>
      ) : null}
      {platform === "nginx" ? (
        <ol className="mt-4 grid gap-2 text-sm text-slate-600">
          <li>
            {t("install.proxy.nginx1Before")} <code>server {"{ }"}</code> {t("install.proxy.nginx1After")}
          </li>
          <li>
            {t("install.proxy.nginx2Before")} <code>nginx -t &amp;&amp; systemctl reload nginx</code>.
          </li>
          <li>{t("install.proxy.nginx3")}</li>
        </ol>
      ) : null}
      {platform === "apache" ? (
        <ol className="mt-4 grid gap-2 text-sm text-slate-600">
          <li>{t("install.proxy.apache1")}</li>
          <li>
            {t("install.proxy.apache2Before")} <code>&lt;VirtualHost *:443&gt;</code> {t("install.proxy.apache2After")}
          </li>
          <li>{t("install.proxy.apache3")}</li>
        </ol>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-sand/70">
        <div className="flex items-center justify-between gap-3 border-b border-line/70 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{fileLabel}</p>
          <button
            type="button"
            onClick={copyConfig}
            className="inline-flex items-center justify-center rounded-xl border border-line bg-white px-3 py-2 text-xs font-semibold text-ink transition hover:bg-mist"
          >
            {copied ? t("install.proxy.copied") : t("install.proxy.copy")}
          </button>
        </div>
        <pre className="overflow-x-auto p-4 text-sm text-ink">
          <code>{config}</code>
        </pre>
      </div>

      <div className="mt-4 rounded-2xl border border-line bg-mist/60 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-ink">{verifiedLabel ? t("install.proxy.verified") : t("install.proxy.notVerified")}</p>
            <p className="mt-1 text-sm text-slate-600">
              {verifiedLabel
                ? t("install.proxy.lastVerified", { date: verifiedLabel })
                : t("install.proxy.willCheck", { host })}
            </p>
          </div>
          <button
            type="button"
            onClick={verify}
            disabled={checking}
            className="inline-flex items-center justify-center rounded-2xl border border-line px-4 py-3 text-sm font-semibold text-ink transition hover:bg-white disabled:opacity-60"
          >
            {checking ? t("install.proxy.checking") : t("install.proxy.verify")}
          </button>
        </div>
        {result ? (
          <p className={`mt-3 text-sm ${result.ok ? "text-accent" : "text-red-600"}`} role="status">
            {result.message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
