import assert from "node:assert/strict";
import { test } from "node:test";
import { satelliteGrant } from "../lib/satellite-entitlements";
import { satelliteLinks } from "../lib/sso/satellite-links";

const secret = "s".repeat(40);
const mcpEnv = { SSO_MCP_CALLBACK_URL: "https://mcp.diyseo.online/sso/callback", SSO_MCP_SECRET: secret };
const adsEnv = { SSO_ADS_CALLBACK_URL: "https://ads.diyseo.online/sso/callback", SSO_ADS_SECRET: secret };

test("links to the satellite login when the plan grants the service", () => {
  assert.deepEqual(satelliteLinks(satelliteGrant("PRO"), mcpEnv), [
    { service: "mcp", label: "SEO data", href: "https://mcp.diyseo.online/login" },
  ]);
});

test("links to the upgrade page when the plan does not grant the service", () => {
  const links = satelliteLinks(satelliteGrant("STARTER"), { ...mcpEnv, ...adsEnv });
  assert.equal(links.find((l) => l.service === "mcp")?.href, "https://mcp.diyseo.online/login");
  const ads = links.find((l) => l.service === "ads");
  assert.equal(ads?.label, "Ads");
  assert.equal(ads?.href, "/billing?upgrade=ads");
});

test("returns nothing when no service is configured", () => {
  assert.deepEqual(satelliteLinks(satelliteGrant("PRO"), {}), []);
});
