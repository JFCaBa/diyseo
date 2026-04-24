"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { updateWidgetInstalledState, updateWidgetTheme, type ActionState } from "@/lib/actions";

type WidgetTheme = "light" | "dark";

type WidgetInstallCardProps = {
  baseUrl: string;
  siteId: string;
  siteDomain?: string | null;
  initialTheme?: WidgetTheme | null;
  widgetInstalledAt?: string | null;
  id?: string;
};

const initialState: ActionState = {};

function formatRouteDomain(value?: string | null) {
  if (!value) {
    return "clientdomain.com";
  }

  try {
    return new URL(value).host.replace(/\/$/, "");
  } catch {
    return value.replace(/^https?:\/\//, "").replace(/\/$/, "");
  }
}

export function WidgetInstallCard({ baseUrl, siteId, siteDomain, initialTheme, widgetInstalledAt, id }: WidgetInstallCardProps) {
  const [copied, setCopied] = useState(false);
  const [workerCopied, setWorkerCopied] = useState(false);
  const [theme, setTheme] = useState<WidgetTheme>(initialTheme === "dark" ? "dark" : "light");
  const formRef = useRef<HTMLFormElement>(null);
  const updateWidgetThemeForSite = updateWidgetTheme.bind(null, siteId);
  const updateWidgetInstalledStateForSite = updateWidgetInstalledState.bind(null, siteId);
  const [state, formAction] = useActionState(updateWidgetThemeForSite, initialState);
  const [installState, installFormAction] = useActionState(updateWidgetInstalledStateForSite, initialState);
  const embedUrl = `${baseUrl}/embed.js`;
  const routeDomain = formatRouteDomain(siteDomain);
  const recommendedRoute = `${routeDomain}/blog*`;
  const snippet = `<div id="soro-widget-container"></div>
<script
  src="${embedUrl}"
  data-site="${siteId}"
  data-base-path="/blog"
  data-theme="${theme}"
></script>`;
  const workerScript = `const DIYSEO_ORIGIN = "${baseUrl}";
const SITE_ID = "${siteId}";
const BLOG_BASE = "/blog";

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", {
        status: 405,
        headers: {
          Allow: "GET, HEAD"
        }
      });
    }

    if (!url.pathname.startsWith(BLOG_BASE)) {
      return new Response("Not found", { status: 404 });
    }

    let originPath = "";

    if (url.pathname === BLOG_BASE || url.pathname === BLOG_BASE + "/") {
      originPath = "/blog/" + SITE_ID;
    } else if (url.pathname === BLOG_BASE + "/sitemap.xml") {
      originPath = "/blog/" + SITE_ID + "/sitemap.xml";
    } else if (url.pathname === BLOG_BASE + "/rss.xml") {
      originPath = "/blog/" + SITE_ID + "/rss.xml";
    } else if (url.pathname === BLOG_BASE + "/atom.xml") {
      originPath = "/blog/" + SITE_ID + "/atom.xml";
    } else {
      const remainder = url.pathname.slice((BLOG_BASE + "/").length);

      if (!remainder || remainder.includes("/")) {
        return new Response("Not found", { status: 404 });
      }

      originPath = "/blog/" + SITE_ID + "/" + remainder;
    }

    const originUrl = new URL(originPath + url.search, DIYSEO_ORIGIN);
    const headers = new Headers(request.headers);
    headers.set("x-forwarded-host", url.host);
    headers.set("x-forwarded-proto", "https");
    headers.set("x-diyseo-site-id", SITE_ID);

    const response = await fetch(originUrl.toString(), {
      method: request.method,
      headers,
      redirect: "manual"
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
  }
};`;
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

  async function handleWorkerCopy() {
    try {
      await navigator.clipboard.writeText(workerScript);
      setWorkerCopied(true);
      window.setTimeout(() => setWorkerCopied(false), 2000);
    } catch {
      setWorkerCopied(false);
    }
  }

  return (
    <section id={id} className="rounded-3xl border border-line bg-white/90 p-6 shadow-panel scroll-mt-24">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink">Install Widget</h2>
          <p className="mt-1 text-sm text-slate-600">
            Simple install: paste one snippet to embed the published blog widget for this site.
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

      <div className="mt-6 rounded-2xl border border-line bg-mist/50 p-4">
        <div>
          <h3 className="text-sm font-semibold text-ink">SEO attribution</h3>
          <p className="mt-1 text-sm text-slate-600">Choose the simple install now, or plan for stronger client-domain SEO later.</p>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-line bg-white/90 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-ink">Simple install</p>
              <span className="rounded-full bg-accent/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
                Available now
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-600">Paste the widget snippet. Fastest setup and good for showing the blog on the site.</p>
            <p className="mt-2 text-xs text-slate-500">SEO note: attribution is limited because the content is rendered by JavaScript.</p>
          </div>

          <div className="rounded-2xl border border-dashed border-line bg-white/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-ink">SEO-optimized install</p>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Advanced
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Serve the blog under the client domain, for example `https://clientdomain.com/blog`.
            </p>
            <p className="mt-2 text-xs text-slate-500">SEO note: stronger attribution because Google sees the content on the client domain.</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-dashed border-line bg-white/60 p-4 opacity-80">
            <p className="text-sm font-semibold text-ink">Reverse proxy</p>
            <p className="mt-1 text-xs text-slate-500">Serve blog routes through the client domain.</p>
          </div>
          <div className="rounded-2xl border border-dashed border-line bg-white/60 p-4 opacity-80">
            <p className="text-sm font-semibold text-ink">Static export</p>
            <p className="mt-1 text-xs text-slate-500">Publish generated pages directly to the client site.</p>
          </div>
          <div className="rounded-2xl border border-dashed border-line bg-white/60 p-4 opacity-80">
            <p className="text-sm font-semibold text-ink">WordPress plugin</p>
            <p className="mt-1 text-xs text-slate-500">Install and sync the blog into a WordPress site.</p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-line bg-white/90 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h4 className="text-sm font-semibold text-ink">Cloudflare Worker publishing</h4>
              <p className="mt-1 text-sm text-slate-600">
                Advanced option: proxy your DIYSEO blog under the client domain at `/blog`.
              </p>
              <p className="mt-2 text-xs font-medium text-slate-500">
                Important: creating the Worker is not enough. You must also attach a route so `/blog*` traffic
                actually runs through this Worker.
              </p>
            </div>
            <button
              type="button"
              onClick={handleWorkerCopy}
              className="inline-flex items-center justify-center rounded-2xl border border-line px-4 py-3 text-sm font-semibold text-ink transition hover:bg-mist"
            >
              {workerCopied ? "Copied" : "Copy Worker Script"}
            </button>
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
              <dt className="font-semibold text-ink">Recommended route</dt>
              <dd className="mt-1 break-all">{recommendedRoute}</dd>
            </div>
          </dl>

          <ol className="mt-4 grid gap-2 text-sm text-slate-600">
            <li>1. Create a Cloudflare Worker and paste this script.</li>
            <li>2. Attach a Cloudflare route to `{recommendedRoute}` and point it to this Worker.</li>
            <li>3. Deploy the Worker after the route is attached.</li>
            <li>4. Test `/blog`, `/blog/sitemap.xml`, `/blog/rss.xml`, and one article URL.</li>
          </ol>

          <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-sand/70">
            <div className="flex items-center justify-between gap-3 border-b border-line/70 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Worker script</p>
              <button
                type="button"
                onClick={handleWorkerCopy}
                className="inline-flex items-center justify-center rounded-xl border border-line bg-white px-3 py-2 text-xs font-semibold text-ink transition hover:bg-mist"
              >
                {workerCopied ? "Copied" : "Copy script"}
              </button>
            </div>
            <pre className="overflow-x-auto p-4 text-sm text-ink">
            <code>{workerScript}</code>
            </pre>
          </div>
        </div>
      </div>

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
