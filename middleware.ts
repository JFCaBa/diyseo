import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_EXACT = new Set(["/", "/privacy", "/terms"]);
const PUBLIC_PREFIXES = ["/blog", "/admin", "/api/auth", "/api/public", "/api/internal/cron", "/api/internal/sites", "/api/v1"];

const SESSION_COOKIES = [
  "__Secure-authjs.session-token",
  "authjs.session-token"
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_EXACT.has(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
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
