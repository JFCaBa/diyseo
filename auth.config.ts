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
      // Sign-in asks only for name and email, which Google does not treat as
      // sensitive. Search Console access is requested later, from Analytics,
      // and include_granted_scopes brings it back on every later sign-in.
      authorization: {
        params: {
          scope: "openid email profile",
          access_type: "offline",
          include_granted_scopes: "true"
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
