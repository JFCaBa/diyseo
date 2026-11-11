import assert from "node:assert/strict";
import { test } from "node:test";

import { unzipSync, strFromU8 } from "fflate";

import {
  buildExportZip,
  buildStaticExport,
  exportPathForSlug,
  ExportError,
  prepareStaticHtml,
  resolveAllowedAssetUrl
} from "@/lib/install-methods/static-export";

const ORIGIN = "https://diyseo.online";
const HOST = "client.com";
const SITE = "site_1";
const CSS_URL = `${ORIGIN}/_next/static/css/a.css`;

const head = (host = HOST) =>
  `<head><meta name="diyseo-site" content="${SITE}"/><link rel="canonical" href="https://${host}/blog"/>` +
  `<link rel="stylesheet" href="${CSS_URL}"/><link rel="preload" as="script" href="${ORIGIN}/_next/static/x.js"/>` +
  `<script src="${ORIGIN}/_next/static/x.js"></script><script type="application/ld+json">{"a":1}</script></head>`;

function fakeFetch(overrides: Record<string, Response | (() => Response)> = {}) {
  const calls: string[] = [];
  const impl = async (url: string) => {
    calls.push(url);
    const override = overrides[new URL(url).pathname];

    if (override) {
      return typeof override === "function" ? override() : override;
    }

    const path = new URL(url).pathname;

    if (path.endsWith(".css")) return new Response("body{color:red}");
    if (path.endsWith(".xml")) return new Response("<xml/>");
    return new Response(`<html>${head()}<body><a href="/blog/post-one">x</a></body></html>`);
  };

  return { impl, calls };
}

test("exportPathForSlug only accepts plain slugs", () => {
  assert.equal(exportPathForSlug("my-post-2"), "blog/my-post-2/index.html");

  for (const bad of ["", "../etc", "a/b", "a\\b", "a?b", "a#b", "A-B", "-a", "a-", "a--b", "x".repeat(101)]) {
    assert.equal(exportPathForSlug(bad), null, bad);
  }
});

test("prepareStaticHtml inlines css and drops scripts except JSON-LD", () => {
  const out = prepareStaticHtml(`<html>${head()}</html>`, new Map([[CSS_URL, "p{margin:0}</style><b>"]]));
  assert.ok(out.includes("<style>p{margin:0}<\\/style><b></style>"));
  assert.ok(!out.includes("<script src"));
  assert.ok(!out.includes('rel="preload"'));
  assert.ok(!out.includes('rel="stylesheet"'));
  assert.ok(out.includes('<script type="application/ld+json">{"a":1}</script>'));
});

test("resolveAllowedAssetUrl only allows https static assets on the app origin", () => {
  assert.ok(resolveAllowedAssetUrl(CSS_URL, ORIGIN));
  assert.ok(resolveAllowedAssetUrl("/_next/static/css/a.css", ORIGIN));

  for (const bad of [
    "http://diyseo.online/_next/static/a.css",
    "https://evil.com/_next/static/a.css",
    "https://169.254.169.254/_next/static/a.css",
    "https://user:pw@diyseo.online/_next/static/a.css",
    "https://diyseo.online/other/a.css",
    "https://diyseo.online:8443/_next/static/a.css",
    "data:text/css,a{}"
  ]) {
    assert.equal(resolveAllowedAssetUrl(bad, ORIGIN), null, bad);
  }
});

test("buildStaticExport returns index, articles and feeds with the client forwarded host", async () => {
  const { impl, calls } = fakeFetch();
  const files = await buildStaticExport({ host: HOST, siteId: SITE, slugs: ["post-one"], origin: ORIGIN, fetchImpl: impl });

  assert.deepEqual(Object.keys(files).sort(), [
    "blog/atom.xml", "blog/index.html", "blog/post-one/index.html", "blog/rss.xml", "blog/sitemap.xml"
  ]);
  assert.ok(files["blog/index.html"].includes("<style>body{color:red}</style>"));
  assert.ok(calls.includes(`${ORIGIN}/blog/${SITE}/post-one`));
  assert.equal(calls.filter((url) => url.endsWith("a.css")).length, 1);
});

test("a site with no articles still exports the index and feeds", async () => {
  const files = await buildStaticExport({ host: HOST, siteId: SITE, slugs: [], origin: ORIGIN, fetchImpl: fakeFetch().impl });
  assert.equal(Object.keys(files).length, 4);
});

test("a non-200 page aborts the export", async () => {
  const { impl } = fakeFetch({ [`/blog/${SITE}/post-one`]: new Response("nope", { status: 500 }) });
  await assert.rejects(
    buildStaticExport({ host: HOST, siteId: SITE, slugs: ["post-one"], origin: ORIGIN, fetchImpl: impl }),
    ExportError
  );
});

test("a redirecting page aborts the export", async () => {
  const { impl } = fakeFetch({ [`/blog/${SITE}/post-one`]: new Response(null, { status: 302, headers: { location: "https://evil.com" } }) });
  await assert.rejects(buildStaticExport({ host: HOST, siteId: SITE, slugs: ["post-one"], origin: ORIGIN, fetchImpl: impl }), ExportError);
});

test("an unsafe slug aborts before any request", async () => {
  const { impl, calls } = fakeFetch();
  await assert.rejects(buildStaticExport({ host: HOST, siteId: SITE, slugs: ["../x"], origin: ORIGIN, fetchImpl: impl }), ExportError);
  assert.equal(calls.length, 0);
});

test("more than 200 articles aborts", async () => {
  const slugs = Array.from({ length: 201 }, (_, i) => `a-${i}`);
  await assert.rejects(buildStaticExport({ host: HOST, siteId: SITE, slugs, origin: ORIGIN, fetchImpl: fakeFetch().impl }), ExportError);
});

test("a stylesheet outside the app assets aborts the export", async () => {
  const evil = `<html><head><meta name="diyseo-site" content="${SITE}"/><link rel="canonical" href="https://${HOST}/blog"/><link rel="stylesheet" href="https://169.254.169.254/x.css"/></head></html>`;
  const { impl } = fakeFetch({ [`/blog/${SITE}`]: new Response(evil) });
  await assert.rejects(buildStaticExport({ host: HOST, siteId: SITE, slugs: [], origin: ORIGIN, fetchImpl: impl }), ExportError);
});

test("an index whose canonical is not on the client host aborts (forwarded host ignored)", async () => {
  const { impl } = fakeFetch({ [`/blog/${SITE}`]: new Response(`<html>${head("diyseo.online")}</html>`) });
  await assert.rejects(buildStaticExport({ host: HOST, siteId: SITE, slugs: [], origin: ORIGIN, fetchImpl: impl }), ExportError);
});

test("a page that still links to the hub address aborts", async () => {
  const leaky = `<html>${head()}<a href="/blog/${SITE}/post-one">x</a></html>`;
  const { impl } = fakeFetch({ [`/blog/${SITE}/post-one`]: new Response(leaky) });
  await assert.rejects(buildStaticExport({ host: HOST, siteId: SITE, slugs: ["post-one"], origin: ORIGIN, fetchImpl: impl }), ExportError);
});

test("an oversized response aborts", async () => {
  const { impl } = fakeFetch({ [`/blog/${SITE}/post-one`]: new Response("x".repeat(2_000_001)) });
  await assert.rejects(buildStaticExport({ host: HOST, siteId: SITE, slugs: ["post-one"], origin: ORIGIN, fetchImpl: impl }), ExportError);
});

test("the zip round-trips", () => {
  const zip = buildExportZip({ "blog/index.html": "<p>hi</p>", "README.txt": "r" });
  const files = unzipSync(zip);
  assert.equal(strFromU8(files["blog/index.html"]), "<p>hi</p>");
  assert.equal(strFromU8(files["README.txt"]), "r");
});

test("pages and stylesheets are fetched from the render origin, canonical checks stay on the client host", async () => {
  const urls: string[] = [];
  const impl = async (url: string) => {
    urls.push(url);
    const path = new URL(url).pathname;
    if (path.endsWith(".css")) return new Response("a{}");
    if (path.endsWith(".xml")) return new Response("<xml/>");
    return new Response(`<html>${head()}</html>`);
  };

  await buildStaticExport({ host: HOST, siteId: SITE, slugs: ["post-one"], origin: ORIGIN, renderOrigin: "http://127.0.0.1:3000", fetchImpl: impl });
  assert.ok(urls.length > 0);
  assert.ok(urls.every((url) => url.startsWith("http://127.0.0.1:3000/")), urls.join(","));
  assert.ok(urls.some((url) => url.endsWith("/_next/static/css/a.css")));
});

test("after the first failure no new page is started and the call waits for running ones", async () => {
  let started = 0;
  let running = 0;
  let peak = 0;
  const impl = async (url: string) => {
    const path = new URL(url).pathname;
    if (path.endsWith(".css")) return new Response("a{}");
    if (path.endsWith(".xml")) return new Response("<xml/>");
    if (path === `/blog/${SITE}`) return new Response(`<html>${head()}</html>`);
    const mine = ++started;
    running += 1;
    peak = Math.max(peak, running);
    await new Promise((resolve) => setTimeout(resolve, 5));
    running -= 1;
    return mine === 1 ? new Response("boom", { status: 500 }) : new Response(`<html>${head()}</html>`);
  };
  const slugs = Array.from({ length: 50 }, (_, i) => `a-${i}`);

  await assert.rejects(buildStaticExport({ host: HOST, siteId: SITE, slugs, origin: ORIGIN, fetchImpl: impl }), ExportError);
  assert.equal(running, 0, "nothing is still rendering when the call returns");
  assert.ok(started < slugs.length, `stopped early (${started} of ${slugs.length})`);
  assert.ok(peak <= 4);
});

test("the readme tells the client to replace the old blog folder", async () => {
  const { buildReadme } = await import("@/lib/install-methods/static-export");
  assert.ok(buildReadme(HOST, new Date("2026-11-11T10:00:00Z")).includes('delete the old "blog" folder'));
});
