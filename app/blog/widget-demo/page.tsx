import Link from "next/link";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type WidgetDemoPageProps = {
  searchParams: Promise<{
    mode?: string;
  }>;
};

function getDemoConfig(mode: string | undefined, siteId: string, detailSlug: string) {
  switch (mode) {
    case "loading":
      return {
        siteId,
        basePath: "/blog",
        initialSlug: "",
        delayMs: 1200,
        label: "Loading state"
      };
    case "empty":
      return {
        siteId: "missing-site",
        basePath: "/blog",
        initialSlug: "",
        delayMs: 0,
        label: "Empty state"
      };
    case "error":
      return {
        siteId,
        basePath: "/broken-blog",
        initialSlug: "",
        delayMs: 0,
        label: "Error state"
      };
    case "detail":
      return {
        siteId,
        basePath: "/blog",
        initialSlug: detailSlug,
        delayMs: 0,
        label: "Detail state"
      };
    case "not-found":
      return {
        siteId,
        basePath: "/blog",
        initialSlug: "missing-article-slug",
        delayMs: 0,
        label: "Not found state"
      };
    default:
      return {
        siteId,
        basePath: "/blog",
        initialSlug: "",
        delayMs: 0,
        label: "Default list state"
      };
  }
}

export default async function WidgetDemoPage({ searchParams }: WidgetDemoPageProps) {
  const params = await searchParams;

  const site = await prisma.siteProject.findFirst({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      articles: {
        where: { status: "PUBLISHED" },
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
        select: { slug: true, title: true },
        take: 1
      }
    }
  });

  if (!site) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-3xl font-semibold text-ink">Widget Demo</h1>
        <p className="mt-4 text-sm text-slate-600">
          No Site Project is available. Seed the database before using the widget demo.
        </p>
      </main>
    );
  }

  const detailSlug = site.articles[0]?.slug ?? "";
  const config = getDemoConfig(params.mode, site.id, detailSlug);

  const setupScript = [
    "(function(){",
    "var delayMs = " + JSON.stringify(config.delayMs) + ";",
    "var initialSlug = " + JSON.stringify(config.initialSlug) + ";",
    "if (initialSlug) {",
    "var url = new URL(window.location.href);",
    "url.searchParams.set('post', initialSlug);",
    "window.history.replaceState('', document.title, url.pathname + url.search + url.hash);",
    "}",
    "if (delayMs > 0) {",
    "var originalFetch = window.fetch.bind(window);",
    "window.fetch = function () {",
    "var args = arguments;",
    "return new Promise(function (resolve, reject) {",
    "window.setTimeout(function () {",
    "originalFetch.apply(window, args).then(resolve).catch(reject);",
    "}, delayMs);",
    "});",
    "};",
    "}",
    "})();"
  ].join("");

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Slice 3</p>
        <h1 className="text-3xl font-semibold text-ink">Embeddable Widget Demo</h1>
        <p className="max-w-3xl text-sm text-slate-600">
          This page loads <code>/embed.js</code> with <code>data-base-path=&quot;/blog&quot;</code> and a
          real demo site id so the widget can be tested against the public API routes.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-3 text-sm">
        <Link className="rounded-2xl border border-line px-4 py-2 hover:bg-white" href="/blog/widget-demo">
          List
        </Link>
        <Link
          className="rounded-2xl border border-line px-4 py-2 hover:bg-white"
          href="/blog/widget-demo?mode=detail"
        >
          Detail
        </Link>
        <Link
          className="rounded-2xl border border-line px-4 py-2 hover:bg-white"
          href="/blog/widget-demo?mode=loading"
        >
          Loading
        </Link>
        <Link
          className="rounded-2xl border border-line px-4 py-2 hover:bg-white"
          href="/blog/widget-demo?mode=empty"
        >
          Empty
        </Link>
        <Link
          className="rounded-2xl border border-line px-4 py-2 hover:bg-white"
          href="/blog/widget-demo?mode=error"
        >
          Error
        </Link>
        <Link
          className="rounded-2xl border border-line px-4 py-2 hover:bg-white"
          href="/blog/widget-demo?mode=not-found"
        >
          Not Found
        </Link>
      </div>

      <div className="mt-8 rounded-3xl border border-line bg-white/80 p-6 shadow-panel">
        <dl className="grid gap-3 text-sm text-slate-600 md:grid-cols-2">
          <div>
            <dt className="font-semibold text-ink">Current mode</dt>
            <dd>{config.label}</dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">Demo site id</dt>
            <dd className="break-all">{config.siteId}</dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">Base path</dt>
            <dd>{config.basePath}</dd>
          </div>
          <div>
            <dt className="font-semibold text-ink">Detail slug</dt>
            <dd>{config.initialSlug || detailSlug || "N/A"}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-8 rounded-3xl border border-dashed border-line bg-white/60 p-6">
        <div id="soro-widget-container" />
      </div>

      <script dangerouslySetInnerHTML={{ __html: setupScript }} />
      <script src="/embed.js" data-site={config.siteId} data-base-path={config.basePath} />
    </main>
  );
}
