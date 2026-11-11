import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = join(__dirname, "..");

// middleware.ts lets nothing through for these routes without a session cookie, but it only checks
// the cookie exists: each handler must authorize the caller against the site's workspace itself.
for (const route of ["verify-proxy", "export"]) {
  test(`api/internal/sites/[siteId]/${route} authorizes before doing any work`, () => {
    const source = readFileSync(join(root, "app", "api", "internal", "sites", "[siteId]", route, "route.ts"), "utf8");
    const guard = source.indexOf("denyUnlessSiteOwner(siteId)");
    assert.ok(guard > -1, "missing denyUnlessSiteOwner");

    for (const work of ["prisma.", "verifyProxy(", "buildStaticExport("]) {
      const at = source.indexOf(work);
      assert.ok(at === -1 || at > guard, `${work} runs before the guard`);
    }
  });
}
