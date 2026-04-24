import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const ADMIN_COOKIE_NAME = "diyseo-admin-session";
export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 12;

export function getConfiguredAdminPassword() {
  return process.env.ADMIN_PASSWORD?.trim() || null;
}

export function buildAdminSessionValue(password: string) {
  return createHash("sha256").update(`diyseo-admin:${password}`).digest("hex");
}

function safeEqualHex(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export async function isAdminAuthenticated() {
  const password = getConfiguredAdminPassword();

  if (!password) {
    return false;
  }

  const cookieStore = await cookies();
  const sessionValue = cookieStore.get(ADMIN_COOKIE_NAME)?.value;

  if (!sessionValue) {
    return false;
  }

  return safeEqualHex(sessionValue, buildAdminSessionValue(password));
}

export async function requireAdminAuth() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin");
  }
}
