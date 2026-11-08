import { notFound, redirect } from "next/navigation";

import { effectivePlan } from "@/lib/entitlements";
import { prisma } from "@/lib/prisma";
import { satelliteGrant, type SatelliteService } from "@/lib/satellite-entitlements";
import { satelliteFrameSrc, satelliteLabel } from "@/lib/sso/satellite-links";

/** A satellite app page (mcp or ads) shown inside the hub layout, so the sidebar stays. */
export async function SatellitePage({
  siteId,
  member,
  service,
  slug
}: {
  siteId: string;
  /** From requireSitePage, called by the page itself. */
  member: { workspaceId: string; role: string };
  service: SatelliteService;
  slug: string[] | undefined;
}) {
  const { workspaceId, role } = member;
  if (slug && slug.length > 1) notFound();
  const src = satelliteFrameSrc(service, slug?.[0] ?? "", role === "OWNER");
  if (!src) notFound();

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { plan: true, trialEndsAt: true }
  });
  if (!workspace || !satelliteGrant(effectivePlan(workspace, new Date()))[service]) {
    redirect(`/${siteId}/billing?upgrade=${service}`);
  }

  return (
    <iframe
      key={src}
      src={src}
      title={satelliteLabel(service)}
      allow="clipboard-write"
      className="-mx-6 -my-8 block h-[calc(100vh-5.5rem)] w-[calc(100%+3rem)] border-0 bg-white"
    />
  );
}
