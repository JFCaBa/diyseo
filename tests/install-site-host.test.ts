import assert from "node:assert/strict";
import { test } from "node:test";

import { formatSiteHost, isVerifiableHost } from "@/lib/install-methods/site-host";

test("formatSiteHost strips scheme and path", () => {
  assert.equal(formatSiteHost("https://client.com/blog"), "client.com");
  assert.equal(formatSiteHost("client.com/foo"), "client.com");
  assert.equal(formatSiteHost(null), "clientdomain.com");
});

test("isVerifiableHost accepts public DNS names only", () => {
  for (const ok of ["client.com", "blog.client.co.uk", "a-b.example.org"]) {
    assert.equal(isVerifiableHost(ok), true, ok);
  }

  for (const bad of [
    "",
    "localhost",
    "127.0.0.1",
    "10.0.0.5",
    "[::1]",
    "client.com:8080",
    "client",
    "intranet.local",
    "svc.internal",
    "a.localhost",
    "client.com/path",
    "user@client.com",
    "169.254.169.254",
    "-bad.com"
  ]) {
    assert.equal(isVerifiableHost(bad), false, bad);
  }
});

test("server code can opt out of the placeholder domain", () => {
  assert.equal(formatSiteHost(null, ""), "");
  assert.equal(formatSiteHost("", ""), "");
  assert.equal(isVerifiableHost(formatSiteHost(null, "")), false);
});
