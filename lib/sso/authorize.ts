import { createHash } from "node:crypto";
import type { WorkspacePlan } from "@/lib/entitlements";
import { satelliteGrant, type SatelliteService } from "@/lib/satellite-entitlements";
import type { PassClaims } from "@/lib/sso/pass";
import type { SsoService } from "@/lib/sso/services";
import type { WorkspaceRole } from "@/lib/workspace-membership";

const MAX_STATE_LENGTH = 200;
const LOGIN_NEXT_PREFIX = "/sso/authorize?";

export type AuthorizeInput = {
  service: SsoService | null;
  state: string | null;
  session: { userId: string; email: string; name: string | null } | null;
  membership: { id: string; workspaceId: string; role: WorkspaceRole } | null;
  plan: WorkspacePlan;
  requestPathAndQuery: string;
};

export type AuthorizeDecision =
  | { kind: "not_found" }
  | { kind: "bad_request" }
  | { kind: "login"; next: string }
  | { kind: "upgrade"; service: SatelliteService; role: WorkspaceRole }
  | { kind: "pass"; callbackUrl: string; claims: PassClaims };

/**
 * What /sso/authorize does for a request. The pass always goes to the callback
 * registered for the service; the request cannot choose where it is sent.
 */
export function decideAuthorize(input: AuthorizeInput): AuthorizeDecision {
  const { service, state, session, membership, plan } = input;
  if (!service) return { kind: "not_found" };
  if (!state || state.length > MAX_STATE_LENGTH) return { kind: "bad_request" };
  if (!session) return { kind: "login", next: input.requestPathAndQuery };
  if (!membership) return { kind: "bad_request" };

  const grant = satelliteGrant(plan);
  if (!grant[service.name]) return { kind: "upgrade", service: service.name, role: membership.role };

  return {
    kind: "pass",
    callbackUrl: service.callbackUrl,
    claims: {
      sub: session.userId,
      email: session.email,
      name: session.name,
      wid: membership.workspaceId,
      mid: membership.id,
      role: membership.role,
      plan,
      grant,
      state,
    },
  };
}

/** Where /sso/login sends the user after sign-in: only back to /sso/authorize. */
export function safeLoginNext(next: string | null | undefined): string {
  return typeof next === "string" && next.startsWith(LOGIN_NEXT_PREFIX) ? next : "/";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** The only script on the page; the CSP allows exactly this text by its hash. */
export const AUTO_POST_SCRIPT = "document.getElementById(\"sso\").submit();";
const AUTO_POST_SCRIPT_HASH = createHash("sha256").update(AUTO_POST_SCRIPT).digest("base64");

/** A page that POSTs `fields` to `callbackUrl` as soon as it loads. */
export function autoPostHtml(callbackUrl: string, fields: Record<string, string>): string {
  const inputs = Object.entries(fields)
    .map(([name, value]) => `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`)
    .join("");
  return (
    "<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"robots\" content=\"noindex\">" +
    "<title>Signing you in</title></head><body>" +
    `<form id="sso" method="post" action="${escapeHtml(callbackUrl)}">${inputs}` +
    "<noscript><button type=\"submit\">Continue</button></noscript></form>" +
    `<script>${AUTO_POST_SCRIPT}</script></body></html>`
  );
}

/** Headers for the auto-POST page: the form may only go to the callback's origin. */
export function autoPostHeaders(callbackUrl: string): Record<string, string> {
  const origin = new URL(callbackUrl).origin;
  return {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": `default-src 'none'; form-action ${origin}; script-src 'sha256-${AUTO_POST_SCRIPT_HASH}'; base-uri 'none'; frame-ancestors 'none'`,
  };
}
