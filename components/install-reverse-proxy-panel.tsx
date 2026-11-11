"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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

const PLATFORMS: Array<{ id: Platform; label: string; fileLabel: string }> = [
  { id: "cloudflare", label: "Cloudflare", fileLabel: "Worker script" },
  { id: "nginx", label: "Nginx", fileLabel: "Nginx config" },
  { id: "apache", label: "Apache", fileLabel: "Apache config" }
];

export function InstallReverseProxyPanel({ baseUrl, siteId, siteDomain, proxyVerifiedAt }: InstallReverseProxyPanelProps) {
  const router = useRouter();
  const [platform, setPlatform] = useState<Platform>("cloudflare");
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const host = formatSiteHost(siteDomain);
  const route = `${host}/blog*`;
  const input = { origin: baseUrl, siteId };
  const config =
    platform === "cloudflare" ? buildWorkerScript(input) : platform === "nginx" ? buildNginxConfig(input) : buildApacheConfig(input);
  const current = PLATFORMS.find((item) => item.id === platform) ?? PLATFORMS[0];
  const verifiedLabel = proxyVerifiedAt
    ? new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric" }).format(new Date(proxyVerifiedAt))
    : null;

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
        setResult({ ok: false, message: (body as { error?: string } | null)?.error ?? "The check failed. Try again." });
      }
    } catch {
      setResult({ ok: false, message: "The check failed. Try again." });
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="mt-4 rounded-2xl border border-line bg-white/90 p-4">
      <div>
        <h4 className="text-sm font-semibold text-ink">Reverse proxy</h4>
        <p className="mt-1 text-sm text-slate-600">
          Your server fetches the blog from DIYSEO and serves it at <code>{host}/blog</code>. Google sees the content on your
          domain. Pick the platform your domain runs on and paste the ready-made configuration.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Platform">
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
          <dt className="font-semibold text-ink">Site ID</dt>
          <dd className="mt-1 break-all">{siteId}</dd>
        </div>
        <div>
          <dt className="font-semibold text-ink">DIYSEO origin</dt>
          <dd className="mt-1 break-all">{baseUrl}</dd>
        </div>
        <div>
          <dt className="font-semibold text-ink">{platform === "cloudflare" ? "Recommended route" : "Path"}</dt>
          <dd className="mt-1 break-all">{platform === "cloudflare" ? route : `${host}/blog`}</dd>
        </div>
      </dl>

      {platform === "cloudflare" ? (
        <>
          <p className="mt-4 text-xs font-medium text-slate-500">
            Important: creating the Worker is not enough. You must also attach a route so <code>{route}</code> traffic
            actually runs through this Worker.
          </p>
          <ol className="mt-3 grid gap-2 text-sm text-slate-600">
            <li>1. Create a Cloudflare Worker and paste this script.</li>
            <li>2. Attach a Cloudflare route to <code>{route}</code> and point it to this Worker.</li>
            <li>3. Deploy the Worker after the route is attached.</li>
            <li>4. Click Verify below.</li>
          </ol>
        </>
      ) : null}
      {platform === "nginx" ? (
        <ol className="mt-4 grid gap-2 text-sm text-slate-600">
          <li>1. Paste the rules inside the <code>server {"{ }"}</code> block of your domain (HTTPS).</li>
          <li>2. Run <code>nginx -t &amp;&amp; systemctl reload nginx</code>.</li>
          <li>3. Click Verify below.</li>
        </ol>
      ) : null}
      {platform === "apache" ? (
        <ol className="mt-4 grid gap-2 text-sm text-slate-600">
          <li>1. Enable the modules listed at the top of the config.</li>
          <li>2. Paste the rules inside the <code>&lt;VirtualHost *:443&gt;</code> block of your domain.</li>
          <li>3. Reload Apache, then click Verify below.</li>
        </ol>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-sand/70">
        <div className="flex items-center justify-between gap-3 border-b border-line/70 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{current.fileLabel}</p>
          <button
            type="button"
            onClick={copyConfig}
            className="inline-flex items-center justify-center rounded-xl border border-line bg-white px-3 py-2 text-xs font-semibold text-ink transition hover:bg-mist"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <pre className="overflow-x-auto p-4 text-sm text-ink">
          <code>{config}</code>
        </pre>
      </div>

      <div className="mt-4 rounded-2xl border border-line bg-mist/60 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-ink">{verifiedLabel ? "Verified" : "Not verified yet"}</p>
            <p className="mt-1 text-sm text-slate-600">
              {verifiedLabel
                ? `Last verified on ${verifiedLabel}. Check again after changing your server.`
                : `We will open https://${host}/blog and check that it serves this site.`}
            </p>
          </div>
          <button
            type="button"
            onClick={verify}
            disabled={checking}
            className="inline-flex items-center justify-center rounded-2xl border border-line px-4 py-3 text-sm font-semibold text-ink transition hover:bg-white disabled:opacity-60"
          >
            {checking ? "Checking…" : "Verify"}
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
