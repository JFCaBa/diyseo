import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";

import authConfig from "@/auth.config";
import { prisma } from "@/lib/prisma";

async function ensureUserWorkspace(userId: string, userName?: string | null) {
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
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user }) {
      if (!user.id) {
        return false;
      }

      await ensureUserWorkspace(user.id, user.name);
      return true;
    },
    async session({ session, user }) {
      if (session.user) {
        const workspace = await prisma.workspace.findUnique({
          where: { ownerId: user.id },
          select: { id: true }
        });

        session.user.id = user.id;
        session.user.workspaceId = workspace?.id ?? null;
      }

      return session;
    }
  }
});
