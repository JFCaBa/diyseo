import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";

import authConfig from "@/auth.config";
import { accountTokenUpdate } from "@/lib/google-account";
import { prisma } from "@/lib/prisma";
import { isListedEmail } from "@/lib/access";
import { getMembership } from "@/lib/workspace-membership";
import { ensureUserWorkspace, findOwnedWorkspaceId } from "@/lib/workspace-provisioning";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "database"
  },
  events: {
    async createUser({ user }) {
      if (!user.id) {
        return;
      }
      await ensureUserWorkspace(user.id, user.name, user.email);
    },
    // An email added to ALLOWED_EMAILS later gets the free plan on its next
    // sign-in. Paying workspaces are left alone: they cancel in the portal.
    async signIn({ user, account }) {
      // Auth.js keeps the tokens from the first link; store each new grant.
      if (account?.provider === "google" && account.providerAccountId) {
        try {
          const where = { provider_providerAccountId: { provider: "google", providerAccountId: account.providerAccountId } };
          const stored = await prisma.account.findUnique({ where, select: { scope: true } });
          const update = stored ? accountTokenUpdate(account, stored.scope) : null;

          if (update) {
            await prisma.account.update({ where, data: update });
          }
        } catch (error) {
          // Never block sign-in over this; Search Console asks to reconnect instead.
          console.error("google_token_update_failed", { code: (error as { code?: string }).code ?? "unknown" });
        }
      }

      // Only the workspace the user owns; a member never changes someone else's plan.
      const ownedWorkspaceId = user.id && isListedEmail(user.email) ? await findOwnedWorkspaceId(user.id) : null;

      if (ownedWorkspaceId) {
        await prisma.workspace.updateMany({
          where: { id: ownedWorkspaceId, plan: { in: ["TRIAL", "NONE"] } },
          data: { plan: "COMP", trialEndsAt: null }
        });
      }
    }
  },
  callbacks: {
    ...authConfig.callbacks,
    async session({ session, user }) {
      if (session.user) {
        const membership = (await getMembership(user.id)) ?? (await ensureUserWorkspace(user.id, user.name, user.email));

        session.user.id = user.id;
        session.user.workspaceId = membership.workspaceId;
        session.user.workspaceRole = membership.role;
      }

      return session;
    }
  }
});
