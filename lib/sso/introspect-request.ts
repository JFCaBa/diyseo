import { z } from "zod";
import { serviceForSecret, type SsoService } from "@/lib/sso/services";

const subSchema = z.object({ sub: z.string().min(1).max(64) }).strict();
const widSchema = z.object({ wid: z.string().min(1).max(64) }).strict();

export type IntrospectParse =
  | { ok: true; service: SsoService; value: string }
  | { ok: false; status: 400 | 401; error: "unauthorized" | "bad_request" };

/** Authenticates a satellite by its bearer secret and validates the JSON body. */
export function parseIntrospectRequest<K extends "sub" | "wid">(
  key: K,
  authorization: string | null,
  rawBody: string,
  env: Record<string, string | undefined> = process.env
): IntrospectParse {
  const service = authenticateService(authorization, env);
  if (!service) return { ok: false, status: 401, error: "unauthorized" };
  return parseIntrospectBody(key, service, rawBody);
}

/** The service whose secret is presented as a bearer token, if any. Checked before the body is read. */
export function authenticateService(
  authorization: string | null,
  env: Record<string, string | undefined> = process.env
): SsoService | null {
  const match = /^Bearer (.+)$/.exec(authorization ?? "");
  return match ? serviceForSecret(match[1], env) : null;
}

const MAX_BODY_CHARS = 1024;

export function parseIntrospectBody(key: "sub" | "wid", service: SsoService, rawBody: string): IntrospectParse {
  if (rawBody.length > MAX_BODY_CHARS) return { ok: false, status: 400, error: "bad_request" };
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return { ok: false, status: 400, error: "bad_request" };
  }
  const parsed = (key === "sub" ? subSchema : widSchema).safeParse(json);
  if (!parsed.success) return { ok: false, status: 400, error: "bad_request" };
  return { ok: true, service, value: (parsed.data as Record<string, string>)[key] };
}

export function introspectResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
