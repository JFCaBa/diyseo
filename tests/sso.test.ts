import assert from "node:assert/strict";
import { test } from "node:test";
import { exportJWK, generateKeyPair } from "jose";
import { signPass, verifyPass, type PassClaims } from "../lib/sso/pass";
import { serviceForSecret, ssoService } from "../lib/sso/services";

const claims: PassClaims = {
  sub: "u1",
  email: "a@b.co",
  name: null,
  wid: "w1",
  mid: "m1",
  role: "OWNER",
  plan: "PRO",
  grant: { mcp: true, ads: true, aiQuestions: 60, adBusinesses: 1 } as PassClaims["grant"],
  state: "st",
};

async function keys() {
  const { publicKey, privateKey } = await generateKeyPair("EdDSA", { crv: "Ed25519", extractable: true });
  return {
    priv: JSON.stringify(await exportJWK(privateKey)),
    pub: JSON.stringify(await exportJWK(publicKey)),
  };
}

const now = new Date("2026-01-01T00:00:00Z");
const at = (s: number) => new Date(now.getTime() + s * 1000);

const fullEnv = {
  SSO_MCP_CALLBACK_URL: "https://mcp.example/cb",
  SSO_MCP_SECRET: "m".repeat(32),
  SSO_ADS_CALLBACK_URL: "https://ads.example/cb",
  SSO_ADS_SECRET: "a".repeat(32),
};

test("a pass verifies for its audience and carries the claims", async () => {
  const k = await keys();
  const token = await signPass("mcp", claims, now, k.priv);
  const out = await verifyPass(token, "mcp", k.pub, now);
  assert.equal(out.mid, "m1");
  assert.equal(out.role, "OWNER");
  assert.equal(out.state, "st");
  assert.ok(out.jti);
});

test("a pass for mcp is rejected by ads", async () => {
  const k = await keys();
  const token = await signPass("mcp", claims, now, k.priv);
  await assert.rejects(verifyPass(token, "ads", k.pub, now));
});

test("a pass is accepted at +64 s and rejected at +66 s", async () => {
  const k = await keys();
  const token = await signPass("mcp", claims, now, k.priv);
  await verifyPass(token, "mcp", k.pub, at(64));
  await assert.rejects(verifyPass(token, "mcp", k.pub, at(66)));
});

test("a pass signed with another key is rejected", async () => {
  const a = await keys();
  const b = await keys();
  const token = await signPass("mcp", claims, now, a.priv);
  await assert.rejects(verifyPass(token, "mcp", b.pub, now));
});

test("a service missing its secret is disabled", () => {
  assert.equal(ssoService("ads", { SSO_ADS_CALLBACK_URL: "https://ads.diyseo.online/x" }), null);
  assert.equal(ssoService("ads", { ...fullEnv, SSO_ADS_SECRET: "short" }), null);
});

test("unknown service names are rejected", () => {
  assert.equal(ssoService("billing", fullEnv), null);
});

test("serviceForSecret finds the service by its secret", () => {
  assert.equal(serviceForSecret("a".repeat(32), fullEnv)?.name, "ads");
  assert.equal(serviceForSecret("x".repeat(32), fullEnv), null);
});

test("a pass missing exp is rejected", async () => {
  const k = await keys();
  const { SignJWT, importJWK } = await import("jose");
  const key = await importJWK(JSON.parse(k.priv), "EdDSA");
  const token = await new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "EdDSA", kid: "hub-1" })
    .setJti("x").setIssuer("https://diyseo.online").setAudience("mcp").setIssuedAt(Math.floor(now.getTime() / 1000))
    .sign(key);
  await assert.rejects(verifyPass(token, "mcp", k.pub, now));
});
