import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";

import authConfig from "@/auth.config";
import { prisma } from "@/lib/prisma";
import { isListedEmail, planForNewWorkspace, trialEndForPlan } from "@/lib/access";

async function ensureUserWorkspace(userId: string, userName?: string | null, email?: string | null) {
  const existingWorkspace = await prisma.workspace.findUnique({
    where: { ownerId: userId },
    include: {
      sites: {
        orderBy: { createdAt: "asc" },
        select: { id: true }
      }
    }
  });

  if (existingWorkspace) {
    if (existingWorkspace.sites.length === 0) {
      await prisma.siteProject.create({
        data: {
          workspaceId: existingWorkspace.id,
          name: "My Site",
          domain: "https://example.com",
          brandProfile: {
            create: {
              contentLanguage: "en"
            }
          }
        }
      });
    }

    return existingWorkspace.id;
  }

  const workspaceName = userName?.trim() ? `${userName.trim()}'s Workspace` : "My Workspace";

  const workspace = await prisma.workspace.create({
    data: {
      plan: planForNewWorkspace(email),
      trialEndsAt: trialEndForPlan(planForNewWorkspace(email), new Date()),
      ownerId: userId,
      name: workspaceName,
      sites: {
        create: {
          name: "My Site",
          domain: "https://example.com",
          brandProfile: {
            create: {
              contentLanguage: "en"
            }
          }
        }
      }
    }
  });

  return workspace.id;
}

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
    async signIn({ user }) {
      if (user.id && isListedEmail(user.email)) {
        await prisma.workspace.updateMany({
          where: { ownerId: user.id, plan: { in: ["TRIAL", "NONE"] } },
          data: { plan: "COMP", trialEndsAt: null }
        });
      }
    }
  },
  callbacks: {
    ...authConfig.callbacks,
    async session({ session, user }) {
      if (session.user) {
        const workspace = await prisma.workspace.findUnique({
          where: { ownerId: user.id },
          select: { id: true }
        });

        if (!workspace) {
          const created = await ensureUserWorkspace(user.id, user.name, user.email);
          session.user.id = user.id;
          session.user.workspaceId = created;
          return session;
        }

        session.user.id = user.id;
        session.user.workspaceId = workspace.id;
      }

      return session;
    }
  }
});
