import assert from "node:assert/strict";
import { test } from "node:test";

import { accountTokenUpdate } from "../lib/google-account";

test("a new grant updates tokens and scope", () => {
  assert.deepEqual(
    accountTokenUpdate({
      access_token: "at",
      expires_at: 123,
      scope: "openid email https://www.googleapis.com/auth/webmasters.readonly",
      refresh_token: "rt",
      id_token: "it",
      token_type: "bearer"
    }),
    {
      access_token: "at",
      expires_at: 123,
      scope: "openid email https://www.googleapis.com/auth/webmasters.readonly",
      refresh_token: "rt",
      id_token: "it",
      token_type: "bearer"
    }
  );
});

test("a sign-in without refresh token keeps the stored one", () => {
  const update = accountTokenUpdate({ access_token: "at", expires_at: 5, scope: "openid email profile" });
  assert.ok(update);
  assert.equal("refresh_token" in update, false);
});

test("a narrower plain sign-in leaves the stored Search Console grant untouched", () => {
  const update = accountTokenUpdate(
    { access_token: "at", expires_at: 5, scope: "openid email profile" },
    "openid email profile https://www.googleapis.com/auth/webmasters.readonly"
  );
  assert.equal(update, null);
});

test("nothing to write when the provider sent no access token", () => {
  assert.equal(accountTokenUpdate({}), null);
});

test("the full webmasters scope also counts as a Search Console grant", () => {
  const update = accountTokenUpdate(
    { access_token: "at", expires_at: 5, scope: "openid email profile" },
    "openid https://www.googleapis.com/auth/webmasters"
  );
  assert.equal(update, null);
});
