import type { SatelliteGrant, SatelliteService } from "@/lib/satellite-entitlements";
import { ssoService } from "@/lib/sso/services";

export type SatelliteNavItem = { label: string; href: string };
export type SatelliteGroup = { service: SatelliteService; label: string; items: SatelliteNavItem[] };

type Page = { label: string; slug: string; path: string; ownerOnly?: boolean };

const LABELS: Record<SatelliteService, string> = { mcp: "SEO data", ads: "Ads" };
const SERVICES: SatelliteService[] = ["mcp", "ads"];

/** Hub base path (relative to the site) that shows each satellite inside the hub layout. */
const BASE: Record<SatelliteService, string> = { mcp: "/seo-data", ads: "/ads" };

/** The satellite pages the hub links to: hub slug → path inside the satellite. Only these can be embedded. */
const PAGES: Record<SatelliteService, Page[]> = {
  mcp: [
    { label: "Connect AI", slug: "", path: "/" },
    { label: "Sources", slug: "sources", path: "/sources" },
    { label: "Crawls", slug: "crawls", path: "/crawls" },
    { label: "Connected apps", slug: "clients", path: "/clients" }
  ],
  ads: [
    { label: "Clients & campaigns", slug: "", path: "/" },
    { label: "Ad connections", slug: "connections", path: "/settings", ownerOnly: true }
  ]
};

/**
 * Sidebar groups for the configured satellites. Hrefs are relative: the sidebar prefixes the current site id.
 * Granted → one item per satellite page (owner-only pages only for the owner); not granted → the upgrade page.
 */
export function satelliteGroups(
  grant: SatelliteGrant,
  isOwner: boolean,
  env: Record<string, string | undefined> = process.env
): SatelliteGroup[] {
  const groups: SatelliteGroup[] = [];
  for (const service of SERVICES) {
    if (!ssoService(service, env)) continue;
    const items = grant[service]
      ? PAGES[service]
          .filter((p) => isOwner || !p.ownerOnly)
          .map((p) => ({ label: p.label, href: p.slug ? `${BASE[service]}/${p.slug}` : BASE[service] }))
      : [{ label: "Upgrade to unlock", href: `/billing?upgrade=${service}` }];
    groups.push({ service, label: LABELS[service], items });
  }
  return groups;
}

/**
 * The URL the hub embeds for a satellite page, or null if the service is not configured, the slug is not one of
 * its pages, or the page is owner-only and the viewer is not the owner.
 */
export function satelliteFrameSrc(
  service: SatelliteService,
  slug: string,
  isOwner: boolean,
  env: Record<string, string | undefined> = process.env
): string | null {
  const sso = ssoService(service, env);
  const page = PAGES[service].find((p) => p.slug === slug);
  if (!sso || !page || (page.ownerOnly && !isOwner)) return null;
  // Through the satellite's /login: it runs the SSO when there is no satellite session yet, then goes to the page.
  const url = new URL("/login", sso.callbackUrl);
  url.searchParams.set("next", page.path);
  return url.toString();
}

export function satelliteLabel(service: SatelliteService): string {
  return LABELS[service];
}
