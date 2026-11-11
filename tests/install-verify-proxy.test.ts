import assert from "node:assert/strict";
import { test } from "node:test";

import { evaluateProxyResponse, isPublicAddress, verifyProxy } from "@/lib/install-methods/verify-proxy";

test("isPublicAddress refuses private, loopback, link-local and reserved ranges", () => {
  for (const ip of [
    "127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254",
    "100.64.0.1", "0.0.0.0", "224.0.0.1", "255.255.255.255", "198.18.0.1",
    "::1", "::", "fe80::1", "fc00::1", "fd12::1", "ff02::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1", "2001:db8::1",
    "not-an-ip", ""
  ]) {
    assert.equal(isPublicAddress(ip), false, ip);
  }
});

test("isPublicAddress accepts global unicast addresses", () => {
  for (const ip of ["93.184.216.34", "8.8.8.8", "172.32.0.1", "2606:4700:4700::1111", "::ffff:8.8.8.8"]) {
    assert.equal(isPublicAddress(ip), true, ip);
  }
});

const good = `<html><head><meta name="diyseo-site" content="site_1"/><link rel="canonical" href="https://client.com/blog"/></head></html>`;

test("evaluateProxyResponse accepts our page with the client canonical", () => {
  assert.equal(evaluateProxyResponse({ status: 200, body: good, host: "client.com", siteId: "site_1" }).ok, true);
});

test("evaluateProxyResponse explains each failure", () => {
  const run = (status: number, body: string, siteId = "site_1") =>
    evaluateProxyResponse({ status, body, host: "client.com", siteId });

  assert.equal((run(404, "") as { reason: string }).reason, "not_found");
  assert.equal((run(301, "") as { reason: string }).reason, "redirect");
  assert.equal((run(500, "") as { reason: string }).reason, "bad_status");
  assert.equal((run(200, "<html>wordpress</html>") as { reason: string }).reason, "not_diyseo");
  assert.equal((run(200, good, "other_site") as { reason: string }).reason, "wrong_site");
  assert.equal(
    (run(200, good.replace("client.com", "diyseo.online")) as { reason: string }).reason,
    "forwarded_host_missing"
  );
});

test("verifyProxy never calls the network for an unsafe host", async () => {
  let calls = 0;
  const deps = { fetchOnce: async () => { calls += 1; return { status: 200, location: null, body: good }; } };

  for (const host of ["127.0.0.1", "localhost", "169.254.169.254", "client.com:8080", "intranet.local"]) {
    const result = await verifyProxy(host, "site_1", deps);
    assert.equal(result.ok, false);
  }

  assert.equal(calls, 0);
});

test("verifyProxy follows one same-host redirect and refuses an off-host one", async () => {
  const seen: string[] = [];
  const follow = {
    fetchOnce: async (_h: string, path: string) => {
      seen.push(path);
      return path === "/blog"
        ? { status: 301, location: "https://client.com/blog/", body: "" }
        : { status: 200, location: null, body: good };
    }
  };
  assert.equal((await verifyProxy("client.com", "site_1", follow)).ok, true);
  assert.deepEqual(seen, ["/blog", "/blog/"]);

  const off = { fetchOnce: async () => ({ status: 301, location: "https://evil.com/blog", body: "" }) };
  const result = await verifyProxy("client.com", "site_1", off);
  assert.equal(result.ok === false && result.reason, "redirect");
});

test("verifyProxy reports unreachable when the request throws", async () => {
  const result = await verifyProxy("client.com", "site_1", { fetchOnce: async () => { throw new Error("boom"); } });
  assert.equal(result.ok === false && result.reason, "unreachable");
});
