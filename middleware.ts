import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_EXACT = new Set(["/", "/es", "/pt", "/privacy", "/terms"]);

/** Request header the root layout reads for `<html lang>`. Set only for the landings; dropped everywhere else so it can't be forged. */
export const PAGE_LOCALE_HEADER = "x-diyseo-page-locale";
const LANDING_LOCALES: Record<string, string> = { "/": "en", "/es": "es", "/pt": "pt" };
const PUBLIC_PREFIXES = ["/blog", "/invite/", "/sso/", "/api/sso/", "/api/auth", "/api/public", "/api/internal/cron", "/api/v1", "/api/stripe/webhook"];
// Only the API-key publishing route under /api/internal/sites runs without a session.
// Every other route there is an admin endpoint and needs one, so a new route is
// protected by default instead of exposed by default.
const PUBLIC_PATTERNS = [/^\/api\/internal\/sites\/[^/]+\/articles\/publish\/?$/];

const SESSION_COOKIES = [
  "__Secure-authjs.session-token",
  "authjs.session-token"
];

function next(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.delete(PAGE_LOCALE_HEADER);
  const pageLocale = LANDING_LOCALES[request.nextUrl.pathname];
  if (pageLocale) headers.set(PAGE_LOCALE_HEADER, pageLocale);
  return NextResponse.next({ request: { headers } });
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_EXACT.has(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p)) ||
    PUBLIC_PATTERNS.some((pattern) => pattern.test(pathname))
  ) {
    return next(request);
  }

  const hasSession = SESSION_COOKIES.some((name) => request.cookies.get(name));
  if (!hasSession) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return next(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|embed\\.js|.*\\..*).*)"]
};
