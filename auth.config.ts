import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

import { canSignIn } from "@/lib/access";

const authConfig = {
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/webmasters.readonly",
          access_type: "offline",
          prompt: "consent"
        }
      }
    })
  ],
  pages: {
    signIn: "/"
  },
  callbacks: {
    signIn({ user }) {
      return canSignIn(user.email) ? true : "/?error=access_limited";
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
