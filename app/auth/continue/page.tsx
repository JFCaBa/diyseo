import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AuthContinuePage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/");
  }

  const workspace = await prisma.workspace.findUnique({
    where: { ownerId: session.user.id },
    select: {
      sites: {
        orderBy: { createdAt: "asc" },
        select: { id: true }
      }
    }
  });

  redirect(workspace?.sites[0]?.id ? `/${workspace.sites[0].id}` : "/settings");
}
