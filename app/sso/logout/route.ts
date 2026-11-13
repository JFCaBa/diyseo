import { signOut } from "@/lib/auth";
import { isTrustedLogoutRequest, ssoLogoutDestination, ssoService } from "@/lib/sso/services";

export const dynamic = "force-dynamic";

/**
 * Ends the hub session on behalf of a satellite ("Sign out" in the Campaign Builder). Without this the Builder only
 * clears its own cookie and /login signs the user straight back in from the hub session. The destination is fixed per
 * service, so this cannot be used as an open redirect.
 */
export async function GET(request: Request): Promise<Response> {
  const service = ssoService(new URL(request.url).searchParams.get("service") ?? "");
  if (!service) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  // A cross-site page cannot sign the user out of the hub; it just lands on the service login.
  if (isTrustedLogoutRequest(request.headers, service)) await signOut({ redirect: false });
  return new Response(null, {
    status: 303,
    headers: { Location: ssoLogoutDestination(service), "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}
