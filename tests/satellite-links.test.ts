import assert from "node:assert/strict";
import { test } from "node:test";
import { satelliteGrant } from "../lib/satellite-entitlements";
import { satelliteFrameSrc, satelliteGroups } from "../lib/sso/satellite-links";

const secret = "s".repeat(40);
const mcpEnv = { SSO_MCP_CALLBACK_URL: "https://mcp.diyseo.online/sso/callback", SSO_MCP_SECRET: secret };
const adsEnv = { SSO_ADS_CALLBACK_URL: "https://ads.diyseo.online/sso/callback", SSO_ADS_SECRET: secret };
const both = { ...mcpEnv, ...adsEnv };

test("a granted satellite gets one hub item per page", () => {
  assert.deepEqual(satelliteGroups(satelliteGrant("PRO"), true, mcpEnv), [
    {
      service: "mcp",
      label: "SEO data",
      items: [
        { label: "Connect AI", href: "/seo-data" },
        { label: "Sources", href: "/seo-data/sources" },
        { label: "Crawls", href: "/seo-data/crawls" },
        { label: "Connected apps", href: "/seo-data/clients" }
      ]
    }
  ]);
});

test("owner-only pages are listed only for the owner", () => {
  const ads = (isOwner: boolean) => satelliteGroups(satelliteGrant("PRO"), isOwner, adsEnv)[0].items.map((i) => i.href);
  assert.deepEqual(ads(true), ["/ads", "/ads/connections"]);
  assert.deepEqual(ads(false), ["/ads"]);
});

test("a satellite the plan does not grant links to the upgrade page", () => {
  const groups = satelliteGroups(satelliteGrant("STARTER"), true, both);
  assert.equal(groups.find((g) => g.service === "mcp")?.items.length, 4);
  assert.deepEqual(groups.find((g) => g.service === "ads")?.items, [
    { label: "Upgrade to unlock", href: "/billing?upgrade=ads" }
  ]);
});

test("returns nothing when no service is configured", () => {
  assert.deepEqual(satelliteGroups(satelliteGrant("PRO"), true, {}), []);
});

test("frame src maps hub slugs to satellite paths and nothing else", () => {
  assert.equal(satelliteFrameSrc("mcp", "", true, both), "https://mcp.diyseo.online/login?next=%2F");
  assert.equal(satelliteFrameSrc("mcp", "sources", false, both), "https://mcp.diyseo.online/login?next=%2Fsources");
  assert.equal(satelliteFrameSrc("ads", "connections", true, both), "https://ads.diyseo.online/login?next=%2Fsettings");
  assert.equal(satelliteFrameSrc("ads", "connections", false, both), null);
  assert.equal(satelliteFrameSrc("mcp", "../oauth/authorize", true, both), null);
  assert.equal(satelliteFrameSrc("mcp", "unknown", true, both), null);
  assert.equal(satelliteFrameSrc("ads", "", true, mcpEnv), null);
});
