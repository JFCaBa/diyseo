import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      workspaceId: string | null;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
