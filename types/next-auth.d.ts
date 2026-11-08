import "next-auth";

import type { WorkspaceRole } from "@/lib/workspace-membership";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      workspaceId: string | null;
      workspaceRole: WorkspaceRole | null;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
