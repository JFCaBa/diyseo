import { randomUUID } from "node:crypto";
import { SignJWT, importJWK, jwtVerify } from "jose";
import { getAppOrigin } from "@/lib/app-origin";
import type { SatelliteGrant, SatelliteService } from "@/lib/satellite-entitlements";
import type { WorkspacePlan } from "@/lib/entitlements";
import type { WorkspaceRole } from "@/lib/workspace-membership";

export type PassClaims = {
  sub: string;
  email: string;
  name: string | null;
  wid: string;
  mid: string;
  role: WorkspaceRole;
  plan: WorkspacePlan;
  grant: SatelliteGrant;
  state: string;
};

const PASS_TTL_SECONDS = 60;
const CLOCK_TOLERANCE_SECONDS = 5;
const KEY_ID = "hub-1";

/** The hub origin without a trailing slash, the same for signing and verifying. */
function issuer(): string {
  return getAppOrigin() || "https://diyseo.online";
}

export async function signPass(
  service: SatelliteService,
  claims: PassClaims,
  now: Date,
  privateJwk: string | undefined = process.env.SSO_PRIVATE_JWK,
): Promise<string> {
  if (!privateJwk) throw new Error("SSO_PRIVATE_JWK is not configured");
  const key = await importJWK(JSON.parse(privateJwk), "EdDSA");
  const iat = Math.floor(now.getTime() / 1000);
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "EdDSA", kid: KEY_ID })
    .setJti(randomUUID())
    .setIssuer(issuer())
    .setAudience(service)
    .setIssuedAt(iat)
    .setExpirationTime(iat + PASS_TTL_SECONDS)
    .sign(key);
}

export async function verifyPass(
  token: string,
  service: SatelliteService,
  publicJwk: string,
  now: Date,
): Promise<PassClaims & { jti: string }> {
  const key = await importJWK(JSON.parse(publicJwk), "EdDSA");
  const { payload } = await jwtVerify(token, key, {
    algorithms: ["EdDSA"],
    issuer: issuer(),
    audience: service,
    clockTolerance: CLOCK_TOLERANCE_SECONDS,
    currentDate: now,
    requiredClaims: ["exp", "iat", "jti"],
    maxTokenAge: PASS_TTL_SECONDS,
  });
  for (const field of ["sub", "email", "wid", "mid", "state"] as const) {
    if (typeof payload[field] !== "string" || !payload[field]) {
      throw new Error(`pass with invalid ${field}`);
    }
  }
  if (payload.role !== "OWNER" && payload.role !== "MEMBER") throw new Error("pass with invalid role");
  if (typeof payload.plan !== "string" || !payload.grant || typeof payload.grant !== "object") {
    throw new Error("pass with invalid plan or grant");
  }
  return payload as unknown as PassClaims & { jti: string };
}
