import type { SatelliteGrant, SatelliteService } from "@/lib/satellite-entitlements";
import { ssoService } from "@/lib/sso/services";

export type SatelliteLink = { service: SatelliteService; label: string; href: string };

const LABELS: Record<SatelliteService, string> = { mcp: "SEO data", ads: "Ads" };
const SERVICES: SatelliteService[] = ["mcp", "ads"];

/** Sidebar links to the configured satellites: straight to their login if the plan grants them, else to the upgrade page. */
export function satelliteLinks(
  grant: SatelliteGrant,
  env: Record<string, string | undefined> = process.env
): SatelliteLink[] {
  const links: SatelliteLink[] = [];
  for (const service of SERVICES) {
    const sso = ssoService(service, env);
    if (!sso) continue;
    const href = grant[service]
      ? new URL("/login", sso.callbackUrl).toString()
      : `/billing?upgrade=${service}`;
    links.push({ service, label: LABELS[service], href });
  }
  return links;
}
