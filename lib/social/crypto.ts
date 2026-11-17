import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

type TokenEnv = Record<string, string | undefined>;

/** Social publishing is not configured on this server (no usable SOCIAL_TOKEN_KEY). */
export class SocialConfigError extends Error {
  constructor(message = "SOCIAL_TOKEN_KEY is not set") {
    super(message);
    this.name = "SocialConfigError";
  }
}

function key(env: TokenEnv): Buffer {
  const raw = env.SOCIAL_TOKEN_KEY?.trim();
  const buf = raw ? Buffer.from(raw, "base64") : null;
  if (!buf || buf.length !== 32) throw new SocialConfigError();
  return buf;
}

/** AES-256-GCM: `v1:<iv>:<tag>:<ciphertext>`, each part base64. */
export function encryptToken(plain: string, env: TokenEnv = process.env): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(env), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(":");
}

export function decryptToken(blob: string, env: TokenEnv = process.env): string {
  const k = key(env);
  const [version, iv, tag, data] = blob.split(":");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Unreadable token");
  const decipher = createDecipheriv("aes-256-gcm", k, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}

export function tokenLast4(plain: string): string {
  return plain.slice(-4);
}
