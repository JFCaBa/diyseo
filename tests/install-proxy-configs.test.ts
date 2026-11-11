import assert from "node:assert/strict";
import { test } from "node:test";

import { buildApacheConfig, buildNginxConfig, buildWorkerScript } from "@/lib/install-methods/proxy-configs";

const input = { origin: "https://diyseo.online", siteId: "site_123" };

test("no config leaks an unreplaced placeholder", () => {
  for (const text of [buildWorkerScript(input), buildNginxConfig(input), buildApacheConfig(input)]) {
    assert.ok(text.includes("site_123"));
    assert.ok(text.includes("diyseo.online"));
    assert.ok(!text.includes("undefined"));
  }
});

test("worker keeps the headers the app needs", () => {
  const worker = buildWorkerScript(input);
  assert.ok(worker.includes('headers.set("x-forwarded-host", url.host)'));
  assert.ok(worker.includes('const DIYSEO_ORIGIN = "https://diyseo.online"'));
});

test("nginx forwards the client host and maps the blog and feed paths", () => {
  const nginx = buildNginxConfig(input);
  assert.ok(nginx.includes("proxy_set_header X-Forwarded-Host $host;"));
  assert.ok(nginx.includes("proxy_set_header X-Forwarded-Proto $scheme;"));
  assert.ok(nginx.includes("proxy_ssl_server_name on;"));
  assert.ok(nginx.includes("proxy_set_header Host diyseo.online;"));
  assert.ok(nginx.includes("rewrite ^ /blog/site_123 break;"));
  // one rule covers /blog/<slug>, /blog/sitemap.xml, /blog/rss.xml and /blog/atom.xml
  assert.ok(nginx.includes("rewrite ^/blog/([^/]+)/?$ /blog/site_123/$1 break;"));
  // proxy_pass has no URI so the rewritten path (and query string) is what is sent
  assert.ok(/proxy_pass https:\/\/diyseo\.online;/.test(nginx));
});

test("apache forwards headers and proxies both rules", () => {
  const apache = buildApacheConfig(input);
  assert.ok(apache.includes("SSLProxyEngine On"));
  assert.ok(apache.includes("ProxyAddHeaders On"));
  assert.ok(apache.includes('RequestHeader set X-Forwarded-Proto "https"'));
  assert.ok(apache.includes("a2enmod proxy proxy_http ssl rewrite headers"));
  assert.ok(apache.includes("RewriteRule ^/blog/?$ https://diyseo.online/blog/site_123 [P,L]"));
  assert.ok(apache.includes("RewriteRule ^/blog/([^/]+)/?$ https://diyseo.online/blog/site_123/$1 [P,L]"));
});

test("worker accepts a trailing slash on articles and does not capture /blogging", () => {
  const worker = buildWorkerScript(input);
  assert.ok(worker.includes('.replace(/\\/$/, "")'));
  assert.ok(worker.includes('url.pathname !== BLOG_BASE && !url.pathname.startsWith(BLOG_BASE + "/")'));
});

test("the generated worker routes paths to the right origin URL", async () => {
  const script = buildWorkerScript(input).replace("export default", "return");
  const seen: Array<{ url: string; host: string | null }> = [];
  const fakeFetch = async (url: string, init: { headers: Headers }) => {
    seen.push({ url, host: init.headers.get("x-forwarded-host") });
    return new Response("ok");
  };
  const worker = new Function("fetch", script)(fakeFetch) as { fetch: (request: Request) => Promise<Response> };
  const call = async (path: string, method = "GET") => worker.fetch(new Request(`https://client.com${path}`, { method }));

  for (const [path, expected] of [
    ["/blog", "https://diyseo.online/blog/site_123"],
    ["/blog/", "https://diyseo.online/blog/site_123"],
    ["/blog/my-post", "https://diyseo.online/blog/site_123/my-post"],
    ["/blog/my-post/", "https://diyseo.online/blog/site_123/my-post"],
    ["/blog/rss.xml", "https://diyseo.online/blog/site_123/rss.xml"],
    ["/blog/sitemap.xml?x=1", "https://diyseo.online/blog/site_123/sitemap.xml?x=1"]
  ]) {
    seen.length = 0;
    assert.equal((await call(path)).status, 200, path);
    assert.equal(seen[0].url, expected, path);
    assert.equal(seen[0].host, "client.com");
  }

  for (const path of ["/blogging", "/blog-preview", "/blog/a/b", "/other"]) {
    assert.equal((await call(path)).status, 404, path);
  }

  assert.equal((await call("/blog", "POST")).status, 405);
});
