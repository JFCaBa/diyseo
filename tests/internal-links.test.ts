import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSystemPrompt } from "../lib/ai/prompts";
import { sanitizeInternalLinks } from "../lib/internal-links";
import { fetchSitePages, isPrivateAddress, parseSitemapLocs, pickSitePages, siteOrigin } from "../lib/site-pages";

const publicDns = async () => ["93.184.216.34"];

const origin = "https://mycarplate.online";
const pages = ["https://mycarplate.online/", "https://mycarplate.online/api", "https://mycarplate.online/countries"];

test("site origin accepts public domains only", () => {
  assert.equal(siteOrigin("mycarplate.online"), origin);
  assert.equal(siteOrigin("https://mycarplate.online/"), origin);
  assert.equal(siteOrigin("www.example.com"), "https://www.example.com");
  for (const bad of ["", "localhost", "127.0.0.1", "10.0.0.5", "[::1]", "intranet", "printer.local"]) {
    assert.equal(siteOrigin(bad), null, bad);
  }
});

test("links to invented pages of the site become plain text; real ones stay", () => {
  const md = [
    "See [our API](https://mycarplate.online/api) and [pricing](https://mycarplate.online/pricing).",
    "Try the [lookup](/lookup), the [home page](https://www.mycarplate.online/) and [countries](https://mycarplate.online/countries/).",
    "Read [Wikipedia](https://en.wikipedia.org/wiki/Vehicle_registration_plate), jump to [a section](#codes), email [us](mailto:a@b.c).",
    "![plate](https://mycarplate.online/img/plate.png)"
  ].join("\n");
  const { markdown, removed } = sanitizeInternalLinks(md, origin, pages);
  assert.deepEqual(removed, ["https://mycarplate.online/pricing", "/lookup"]);
  assert.ok(markdown.includes("[our API](https://mycarplate.online/api)"));
  assert.ok(markdown.includes(" and pricing."));
  assert.ok(markdown.includes("Try the lookup, the [home page](https://www.mycarplate.online/)"));
  assert.ok(markdown.includes("[countries](https://mycarplate.online/countries/)"));
  assert.ok(markdown.includes("[Wikipedia](https://en.wikipedia.org/wiki/Vehicle_registration_plate)"));
  assert.ok(markdown.includes("[a section](#codes)"));
  assert.ok(markdown.includes("[us](mailto:a@b.c)"));
  assert.ok(markdown.includes("![plate](https://mycarplate.online/img/plate.png)"));
});

test("without known pages only the home page may be linked", () => {
  const { markdown } = sanitizeInternalLinks("[home](https://mycarplate.online) [about](/about)", origin, []);
  assert.equal(markdown, "[home](https://mycarplate.online) about");
});

test("sitemap pages: same site only, deduplicated, shallowest first, home first, capped", () => {
  const { isIndex, locs } = parseSitemapLocs(
    "<urlset><url><loc>https://mycarplate.online/price/es/seat/ibiza/2024</loc></url>" +
      "<url><loc>https://mycarplate.online/api</loc></url><url><loc>https://mycarplate.online/api/</loc></url>" +
      "<url><loc>https://other.site/x</loc></url><url><loc> https://www.mycarplate.online/countries </loc></url>" +
      "<url><loc>https://mycarplate.online/</loc></url></urlset>"
  );
  assert.equal(isIndex, false);
  assert.deepEqual(pickSitePages(locs, origin), [
    "https://mycarplate.online/",
    "https://mycarplate.online/api",
    "https://www.mycarplate.online/countries",
    "https://mycarplate.online/price/es/seat/ibiza/2024"
  ]);
  assert.equal(pickSitePages(locs, origin, 2).length, 2);
});

function fakeFetch(files: Record<string, string>, redirects: Record<string, string> = {}) {
  const calls: string[] = [];
  const fn = async (url: string) => {
    calls.push(url);
    if (redirects[url]) return new Response(null, { status: 301, headers: { location: redirects[url] } });
    const body = files[url];
    return body === undefined ? new Response("not found", { status: 404 }) : new Response(body, { status: 200 });
  };
  return { fn, calls };
}

test("fetchSitePages follows one level of sitemap index on the same site", async () => {
  const { fn, calls } = fakeFetch({
    "https://mycarplate.online/sitemap.xml":
      "<sitemapindex><sitemap><loc>https://mycarplate.online/sitemap-pages.xml</loc></sitemap>" +
      "<sitemap><loc>https://evil.example/sitemap.xml</loc></sitemap></sitemapindex>",
    "https://mycarplate.online/sitemap-pages.xml": "<urlset><url><loc>https://mycarplate.online/docs</loc></url></urlset>"
  });
  assert.deepEqual(await fetchSitePages("mycarplate.online", fn, publicDns), ["https://mycarplate.online/", "https://mycarplate.online/docs"]);
  assert.ok(!calls.some((c) => c.includes("evil.example")));
});

test("fetchSitePages falls back to the home page, and refuses private hosts", async () => {
  assert.deepEqual(await fetchSitePages("mycarplate.online", fakeFetch({}).fn, publicDns), ["https://mycarplate.online/"]);
  const boom = async () => {
    throw new Error("network down");
  };
  assert.deepEqual(await fetchSitePages("mycarplate.online", boom, publicDns), ["https://mycarplate.online/"]);
  const { fn, calls } = fakeFetch({});
  assert.deepEqual(await fetchSitePages("localhost", fn, publicDns), []);
  assert.equal(calls.length, 0);
});

test("the prompt lists the real pages and forbids invented paths", () => {
  const base = { site: { name: "MyCarPlate", domain: "mycarplate.online" }, brandProfile: {} };
  const withPages = buildSystemPrompt({ ...base, sitePages: pages });
  assert.ok(withPages.includes("https://mycarplate.online/countries"));
  assert.ok(withPages.includes("Never link to a URL that is not in this list"));
  assert.ok(!withPages.includes("plausible category paths"));
  const homeOnly = buildSystemPrompt({ ...base, sitePages: ["https://mycarplate.online/"] });
  assert.ok(homeOnly.includes("Do not link to any other page of the site"));
});

test("links in any Markdown form are cleaned; code blocks are not touched", () => {
  const md = [
    "Check [prices][p] and [the docs][d], or [p].",
    "",
    "[p]: https://mycarplate.online/pricing",
    '[d]: https://mycarplate.online/api "API"',
    "",
    'Or <a href="/lookup">look up a plate</a> and <a href="https://mycarplate.online/countries">countries</a>.',
    "",
    "```html",
    '<a href="/lookup">example</a> [x](/pricing)',
    "```"
  ].join("\n");
  const { markdown, removed } = sanitizeInternalLinks(md, origin, pages);
  assert.deepEqual(removed.sort(), ["/lookup", "https://mycarplate.online/pricing"]);
  assert.ok(markdown.includes("Check prices and [the docs][d], or p."));
  assert.ok(!markdown.includes("[p]: "));
  assert.ok(markdown.includes('[d]: https://mycarplate.online/api "API"'));
  assert.ok(markdown.includes("Or look up a plate and <a href=\"https://mycarplate.online/countries\">countries</a>."));
  assert.ok(markdown.includes('<a href="/lookup">example</a> [x](/pricing)'));
});

test("sitemap locs wrapped in CDATA are read", () => {
  assert.deepEqual(parseSitemapLocs("<urlset><url><loc><![CDATA[https://mycarplate.online/docs]]></loc></url></urlset>").locs, [
    "https://mycarplate.online/docs"
  ]);
});

test("redirects are followed only within the site, and private addresses are never fetched", async () => {
  const within = fakeFetch(
    { "https://mycarplate.online/sitemap-main.xml": "<urlset><url><loc>https://mycarplate.online/docs</loc></url></urlset>" },
    { "https://mycarplate.online/sitemap.xml": "/sitemap-main.xml" }
  );
  assert.deepEqual(await fetchSitePages("mycarplate.online", within.fn, publicDns), ["https://mycarplate.online/", "https://mycarplate.online/docs"]);

  const away = fakeFetch({}, { "https://mycarplate.online/sitemap.xml": "http://169.254.169.254/latest/meta-data" });
  assert.deepEqual(await fetchSitePages("mycarplate.online", away.fn, publicDns), ["https://mycarplate.online/"]);
  assert.ok(!away.calls.some((c) => c.includes("169.254")));

  const internal = fakeFetch({ "https://mycarplate.online/sitemap.xml": "<urlset/>" });
  assert.deepEqual(await fetchSitePages("mycarplate.online", internal.fn, async () => ["10.0.0.7"]), ["https://mycarplate.online/"]);
  assert.equal(internal.calls.length, 0);

  for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "::1", "fd00::1", "::ffff:127.0.0.1"]) {
    assert.equal(isPrivateAddress(ip), true, ip);
  }
  assert.equal(isPrivateAddress("93.184.216.34"), false);
});
