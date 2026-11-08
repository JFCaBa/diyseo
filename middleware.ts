import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_EXACT = new Set(["/", "/privacy", "/terms"]);
const PUBLIC_PREFIXES = ["/blog", "/invite/", "/admin", "/api/auth", "/api/public", "/api/internal/cron", "/api/v1", "/api/stripe/webhook"];
// Only the API-key publishing route under /api/internal/sites runs without a session.
// Every other route there is an admin endpoint and needs one, so a new route is
// protected by default instead of exposed by default.
const PUBLIC_PATTERNS = [/^\/api\/internal\/sites\/[^/]+\/articles\/publish\/?$/];

const SESSION_COOKIES = [
  "__Secure-authjs.session-token",
  "authjs.session-token"
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_EXACT.has(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p)) ||
    PUBLIC_PATTERNS.some((pattern) => pattern.test(pathname))
  ) {
    return NextResponse.next();
  }

  const hasSession = SESSION_COOKIES.some((name) => request.cookies.get(name));
  if (!hasSession) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|embed\\.js|.*\\..*).*)"]
};
