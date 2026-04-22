import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function IndexPage() {
  const firstSite = await prisma.siteProject.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true }
  });

  if (!firstSite) {
    redirect("/settings");
  }

  redirect(`/${firstSite.id}`);
}
