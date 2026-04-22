import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

const authConfig = {
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
