"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useT } from "@/components/i18n-provider";
import type { MessageKey } from "@/lib/i18n/translate";
import type { SatelliteGroup } from "@/lib/sso/satellite-links";
import { cn } from "@/lib/utils";

type NavItem = { label: string; href: string };
type NavGroup = { label: string; items: NavItem[] };
type KeyedGroup = { labelKey: MessageKey; items: Array<{ labelKey: MessageKey; href: string }> };

const blogGroup: KeyedGroup = {
  labelKey: "nav.blog",
  items: [
    { labelKey: "nav.dashboard", href: "" },
    { labelKey: "nav.brandDna", href: "/brand-dna" },
    { labelKey: "nav.calendar", href: "/calendar" },
    { labelKey: "nav.articles", href: "/articles" },
    { labelKey: "nav.keywords", href: "/keywords" },
    { labelKey: "nav.analytics", href: "/analytics" },
    { labelKey: "nav.api", href: "/api" },
    { labelKey: "nav.settings", href: "/settings" }
  ]
};

const accountGroup: KeyedGroup = {
  labelKey: "nav.account",
  items: [
    { labelKey: "nav.team", href: "/team" },
    { labelKey: "nav.billing", href: "/billing" }
  ]
};

/** Items with sub-pages (e.g. Articles) stay active below them; group roots ("", "/ads") only on themselves. */
const NESTED = new Set(["/brand-dna", "/calendar", "/articles", "/keywords", "/analytics", "/api"]);

/** Absolute: not prefixed with the site id. */
const ADMIN_HREF = "/admin";

type SidebarNavProps = {
  siteId: string;
  satellites: SatelliteGroup[];
  isAdmin?: boolean;
};

export function SidebarNav({ siteId, satellites, isAdmin = false }: SidebarNavProps) {
  const pathname = usePathname();
  const t = useT();
  const translate = (group: KeyedGroup): NavGroup => ({
    label: t(group.labelKey),
    items: group.items.map((item) => ({ label: t(item.labelKey), href: item.href }))
  });
  const account: KeyedGroup = isAdmin
    ? { ...accountGroup, items: [...accountGroup.items, { labelKey: "nav.admin", href: ADMIN_HREF }] }
    : accountGroup;
  const satelliteNav: NavGroup[] = satellites.map((group) => ({
    label: t(group.labelKey),
    items: group.items.map((item) => ({ label: t(item.labelKey), href: item.href }))
  }));
  const groups: NavGroup[] = [translate(blogGroup), ...satelliteNav, translate(account)];

  return (
    <nav className="space-y-6">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="mb-2 px-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
            {group.label}
          </p>
          <div className="space-y-1">
            {group.items.map((item) => {
              const href = item.href === ADMIN_HREF ? ADMIN_HREF : `/${siteId}${item.href}`;
              const path = href.split("?")[0];
              const active = pathname === path || (NESTED.has(item.href) && pathname.startsWith(`${path}/`));

              return (
                <Link
                  key={item.href}
                  href={href}
                  className={cn(
                    "flex items-center rounded-2xl px-4 py-2.5 text-sm font-medium transition hover:bg-slate-50 hover:text-ink dark:hover:bg-slate-800 dark:hover:text-slate-100",
                    active
                      ? "bg-slate-50 text-ink shadow-sm dark:bg-slate-800 dark:text-slate-100"
                      : "text-slate-600 dark:text-slate-400"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
