import { createHash, timingSafeEqual } from "node:crypto";
import type { SatelliteService } from "@/lib/satellite-entitlements";

export type SsoService = { name: SatelliteService; callbackUrl: string; secret: string };

type Env = Record<string, string | undefined>;

const SERVICES: SatelliteService[] = ["mcp", "ads"];
const MIN_SECRET_LENGTH = 32;

/** https only; plain http is accepted just for localhost / 127.0.0.1 (development). */
function isValidCallbackUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol === "https:") return true;
  return url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
}

export function ssoService(name: string, env: Env = process.env): SsoService | null {
  if (!(SERVICES as string[]).includes(name)) return null;
  const key = name.toUpperCase();
  const callbackUrl = env[`SSO_${key}_CALLBACK_URL`];
  const secret = env[`SSO_${key}_SECRET`];
  if (!callbackUrl || !isValidCallbackUrl(callbackUrl) || !secret || secret.length < MIN_SECRET_LENGTH) return null;
  return { name: name as SatelliteService, callbackUrl, secret };
}

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

export function serviceForSecret(secret: string, env: Env = process.env): SsoService | null {
  const given = digest(secret);
  let found: SsoService | null = null;
  // Always visit every service so timing does not reveal which one matched.
  for (const name of SERVICES) {
    const service = ssoService(name, env);
    if (!service) continue;
    if (timingSafeEqual(given, digest(service.secret)) && !found) found = service;
  }
  return found;
}
