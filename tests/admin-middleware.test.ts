import assert from "node:assert/strict";
import { test } from "node:test";

import { NextRequest } from "next/server";

import { middleware } from "../middleware";

function request(path: string, cookie?: string) {
  return new NextRequest(`http://x${path}`, cookie ? { headers: { cookie } } : undefined);
}

function redirectsHome(res: Response) {
  return res.status >= 300 && res.status < 400 && new URL(res.headers.get("location")!).pathname === "/";
}

test("/admin entries without a session cookie redirect to /", () => {
  assert.equal(redirectsHome(middleware(request("/admin"))), true);
  assert.equal(redirectsHome(middleware(request("/admin/users"))), true);
});

test("/admin entries with a session cookie pass through", () => {
  const res = middleware(request("/admin/users", "authjs.session-token=abc"));
  assert.equal(res.headers.get("x-middleware-next"), "1");
  assert.equal(res.headers.get("location"), null);
});

test("/blog stays public", () => {
  const res = middleware(request("/blog"));
  assert.equal(res.headers.get("x-middleware-next"), "1");
});
