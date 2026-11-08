import { introspectWorkspace } from "@/lib/sso/introspect";
import { authenticateService, introspectResponse, parseIntrospectBody } from "@/lib/sso/introspect-request";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  // Authenticate before reading the body, so an unauthenticated caller costs nothing.
  const service = authenticateService(request.headers.get("authorization"));
  if (!service) return introspectResponse(401, { error: "unauthorized" });
  const parsed = parseIntrospectBody("wid", service, await request.text());
  if (!parsed.ok) return introspectResponse(parsed.status, { error: parsed.error });
  return introspectResponse(200, await introspectWorkspace(parsed.value, new Date()));
}
