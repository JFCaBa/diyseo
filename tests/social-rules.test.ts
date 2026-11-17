import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { effectiveStatus, publishBlocker, textBlocker } from "../lib/social/rules";

const now = new Date("2026-11-17T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);

test("effectiveStatus shows a PUBLISHING older than 5 minutes as UNKNOWN", () => {
  assert.equal(effectiveStatus({ status: "PUBLISHING", updatedAt: ago(4 * 60_000 + 59_000) }, now), "PUBLISHING");
  assert.equal(effectiveStatus({ status: "PUBLISHING", updatedAt: ago(5 * 60_000 + 1000) }, now), "UNKNOWN");
  for (const s of ["DRAFT", "FAILED", "PUBLISHED"] as const) assert.equal(effectiveStatus({ status: s, updatedAt: ago(3_600_000) }, now), s);
});

test("textBlocker: empty, over the limit, more than 30 Instagram hashtags; zero hashtags is fine", () => {
  assert.equal(textBlocker("FACEBOOK", "   "), "Text is empty");
  assert.equal(textBlocker("X", "x".repeat(251)), "Text is over the 250-character limit");
  assert.equal(textBlocker("INSTAGRAM", Array.from({ length: 31 }, (_, i) => `#t${i}`).join(" ")), "Instagram allows at most 30 hashtags");
  assert.equal(textBlocker("INSTAGRAM", "No hashtags at all"), null);
  assert.equal(textBlocker("LINKEDIN", "Fine"), null);
});

const ok = { network: "FACEBOOK" as const, text: "Hello", status: "DRAFT" as const, articleStatus: "PUBLISHED" as const, hasConnection: true, hasInstagram: true, hasCover: true };

test("publishBlocker", () => {
  assert.equal(publishBlocker(ok), null);
  assert.equal(publishBlocker({ ...ok, network: "INSTAGRAM" }), null);
  assert.equal(publishBlocker({ ...ok, network: "FACEBOOK", hasCover: false }), null);
  assert.equal(publishBlocker({ ...ok, articleStatus: "DRAFT" }), "Publish the article first");
  assert.equal(publishBlocker({ ...ok, status: "PUBLISHED" }), "Already published");
  assert.equal(publishBlocker({ ...ok, status: "PUBLISHING" }), "Publishing in progress");
  assert.equal(publishBlocker({ ...ok, text: "" }), "Text is empty");
  assert.equal(publishBlocker({ ...ok, text: "f".repeat(1501) }), "Text is over the 1500-character limit");
  assert.equal(publishBlocker({ ...ok, hasConnection: false }), "Connect a Facebook Page in site settings");
  assert.equal(publishBlocker({ ...ok, network: "INSTAGRAM", hasInstagram: false }), "No Instagram account is linked to the Page");
  assert.equal(publishBlocker({ ...ok, network: "INSTAGRAM", hasCover: false }), "Instagram needs a cover image stored in DIYSEO");
  assert.equal(publishBlocker({ ...ok, network: "X" }), "Open the network to post");
  assert.equal(publishBlocker({ ...ok, network: "LINKEDIN" }), "Open the network to post");
});

test("social actions file scopes every query by workspace", () => {
  const src = readFileSync("lib/social-actions.ts", "utf8");
  const fns = src.split(/\nexport async function /).slice(1);
  assert.ok(fns.length >= 7, "expected the social actions");
  for (const fn of fns) {
    const name = fn.slice(0, fn.indexOf("("));
    if (/prisma\.(socialPost|siteSocialConnection|article)\./.test(fn) || /claimSocialPost\(/.test(fn)) {
      assert.match(fn, /require(Workspace|Owner)\(|memberOrNull\(|ownerOrNull\(/, `${name} must resolve the caller's workspace`);
      assert.match(fn, /requireSiteInWorkspace\(|findSiteInWorkspace\(/, `${name} must check the site belongs to the workspace`);
    }
  }
});

test("pages never pass the token to client components", () => {
  const files = [
    "app/[siteId]/articles/[articleId]/page.tsx",
    "app/[siteId]/settings/page.tsx",
    "components/social-posts-panel.tsx",
    "components/site-social-connection-form.tsx"
  ];
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    assert.ok(!src.includes("accessTokenEncrypted"), `${f} must not mention accessTokenEncrypted`);
    assert.ok(!src.includes("decryptToken"), `${f} must not decrypt tokens`);
  }
  for (const page of files.slice(0, 2)) {
    const src = readFileSync(page, "utf8");
    assert.match(src, /socialConnection: \{ select: \{/, `${page} must select the connection fields explicitly`);
  }
});

test("shareBlocker stops sharing a draft article or an over-limit text on X and LinkedIn", async () => {
  const { shareBlocker } = await import("../lib/social/rules");
  assert.equal(shareBlocker({ network: "X", text: "ok", articleStatus: "DRAFT" }), "Publish the article first");
  assert.equal(shareBlocker({ network: "X", text: "x".repeat(251), articleStatus: "PUBLISHED" }), "Text is over the 250-character limit");
  assert.equal(shareBlocker({ network: "LINKEDIN", text: "ok", articleStatus: "PUBLISHED" }), null);
});

test("articleText falls back to the HTML when the Markdown is empty, and is capped", async () => {
  const { articleText } = await import("../lib/social/drafts");
  assert.equal(articleText("", "<p>Hello <b>world</b></p>"), "Hello world");
  assert.equal(articleText(null, "<p>A</p>"), "A");
  assert.equal(articleText("# Md", "<p>x</p>"), "# Md");
  assert.equal(articleText("y".repeat(13_000), "").length, 12_000);
});
