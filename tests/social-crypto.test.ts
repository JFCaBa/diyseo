import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";

import { SocialConfigError, decryptToken, encryptToken, tokenLast4 } from "../lib/social/crypto";

const env = { SOCIAL_TOKEN_KEY: randomBytes(32).toString("base64") };

test("round-trips a token", () => {
  assert.equal(decryptToken(encryptToken("EAAB-page-token-123", env), env), "EAAB-page-token-123");
});

test("two encryptions of the same token differ", () => {
  assert.notEqual(encryptToken("same", env), encryptToken("same", env));
});

test("a tampered blob throws", () => {
  const blob = encryptToken("secret-token", env);
  const parts = blob.split(":");
  const data = Buffer.from(parts[3], "base64");
  data[0] ^= 1;
  parts[3] = data.toString("base64");
  assert.throws(() => decryptToken(parts.join(":"), env));
});

test("missing or short key throws SocialConfigError", () => {
  assert.throws(() => encryptToken("x", {}), SocialConfigError);
  assert.throws(() => encryptToken("x", { SOCIAL_TOKEN_KEY: randomBytes(16).toString("base64") }), SocialConfigError);
  assert.throws(() => decryptToken("v1:a:b:c", {}), SocialConfigError);
});

test("tokenLast4 returns the last 4 characters", () => {
  assert.equal(tokenLast4("abcdefgh"), "efgh");
});
