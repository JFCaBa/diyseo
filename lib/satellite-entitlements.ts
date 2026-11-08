import { limitsFor, type WorkspacePlan } from "@/lib/entitlements";

export type SatelliteService = "mcp" | "ads";

/** What a plan grants in the satellite services. `null` means unlimited. */
export type SatelliteGrant = {
  mcp: boolean;
  ads: boolean;
  aiQuestions: number | null;
  adBusinesses: number | null;
};

export function satelliteGrant(plan: WorkspacePlan): SatelliteGrant {
  if (plan === "COMP") return { mcp: true, ads: true, aiQuestions: null, adBusinesses: null };
  if (plan === "NONE") return { mcp: false, ads: false, aiQuestions: 0, adBusinesses: 0 };
  const limits = limitsFor(plan)!;
  return { mcp: true, ads: limits.adBusinesses > 0, aiQuestions: limits.aiQuestions, adBusinesses: limits.adBusinesses };
}

/** Team seats for a plan; `null` means unlimited. Pending invites count against it. */
export function memberLimit(plan: WorkspacePlan): number | null {
  const limits = limitsFor(plan);
  return limits ? limits.members : null;
}
