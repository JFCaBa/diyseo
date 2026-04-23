import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

function getAllowedEmails() {
  return new Set(
    (process.env.ALLOWED_EMAILS ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  );
}

const authConfig = {
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET
    })
  ],
  pages: {
    signIn: "/"
  },
  callbacks: {
    signIn({ user }) {
      const allowedEmails = getAllowedEmails();

      if (allowedEmails.size === 0) {
        return true;
      }

      const email = user.email?.trim().toLowerCase();

      if (!email || !allowedEmails.has(email)) {
        return "/?error=access_limited";
      }

      return true;
    },
    authorized({ auth, request }) {
      const pathname = request.nextUrl.pathname;

      if (
        pathname === "/" ||
        pathname.startsWith("/blog") ||
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/api/public")
      ) {
        return true;
      }

      return !!auth;
    }
  }
} satisfies NextAuthConfig;

export default authConfig;
