import { auth } from "@/lib/auth";
import { effectivePlan, type WorkspacePlan } from "@/lib/entitlements";
import { prisma } from "@/lib/prisma";
import { autoPostHeaders, autoPostHtml, decideAuthorize } from "@/lib/sso/authorize";
import { signPass } from "@/lib/sso/pass";
import { ssoService } from "@/lib/sso/services";
import { getMembership } from "@/lib/workspace-membership";

export const dynamic = "force-dynamic";

function plain(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function redirectTo(location: string): Response {
  return new Response(null, {
    status: 303,
    headers: { Location: location, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const serviceName = url.searchParams.get("service") ?? "";
  const state = url.searchParams.get("state");
  const service = ssoService(serviceName);

  // Only `service` and `state` are read; anything else in the query is ignored.
  const requestPathAndQuery = `/sso/authorize?${new URLSearchParams({ service: serviceName, state: state ?? "" })}`;

  const session = service && state ? await auth() : null;
  const userId = session?.user?.id;
  const membership = userId ? await getMembership(userId) : null;

  let plan: WorkspacePlan = "NONE";
  if (membership) {
    const workspace = await prisma.workspace.findUnique({
      where: { id: membership.workspaceId },
      select: { plan: true, trialEndsAt: true },
    });
    if (workspace) plan = effectivePlan(workspace, new Date());
  }

  const decision = decideAuthorize({
    service,
    state,
    session: userId ? { userId, email: session?.user?.email ?? "", name: session?.user?.name ?? null } : null,
    membership,
    plan,
    requestPathAndQuery,
  });

  switch (decision.kind) {
    case "not_found":
      return plain(404, "Not found");
    case "bad_request":
      return plain(400, "Bad request");
    case "login":
      return redirectTo(`/sso/login?next=${encodeURIComponent(decision.next)}`);
    case "upgrade":
      return redirectTo(`/billing?upgrade=${decision.service}`);
    case "pass": {
      if (!process.env.SSO_PRIVATE_JWK) {
        console.error("sso_authorize_failed", { code: "signing_key_missing" });
        return plain(503, "Sign-in is temporarily unavailable");
      }
      let pass: string;
      try {
        pass = await signPass(service!.name, decision.claims, new Date());
      } catch {
        console.error("sso_authorize_failed", { code: "signing_failed" });
        return plain(503, "Sign-in is temporarily unavailable");
      }
      return new Response(autoPostHtml(decision.callbackUrl, { pass, state: decision.claims.state }), {
        status: 200,
        headers: autoPostHeaders(decision.callbackUrl),
      });
    }
  }
}
