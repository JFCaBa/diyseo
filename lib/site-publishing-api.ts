import { createHash, randomBytes } from "node:crypto";

import { prisma } from "@/lib/prisma";

const RAW_KEY_PREFIX = "diyseo_spk_";

export function hashPublishingApiKey(rawKey: string) {
  return createHash("sha256").update(rawKey).digest("hex");
}

export function generatePublishingApiKey() {
  const secret = randomBytes(24).toString("base64url");
  const rawKey = `${RAW_KEY_PREFIX}${secret}`;

  return {
    rawKey,
    keyHash: hashPublishingApiKey(rawKey),
    keyPrefix: rawKey.slice(0, 16)
  };
}

export async function findActivePublishingApiKeyForSite(siteId: string, rawKey: string) {
  return prisma.sitePublishingApiKey.findFirst({
    where: {
      siteProjectId: siteId,
      keyHash: hashPublishingApiKey(rawKey),
      revokedAt: null
    },
    select: {
      id: true,
      siteProjectId: true,
      label: true
    }
  });
}

export function extractPublishingApiKey(request: Request) {
  const authorization = request.headers.get("authorization");

  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim();
  }

  return request.headers.get("x-api-key")?.trim() ?? "";
}
