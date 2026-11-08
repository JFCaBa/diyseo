"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { SatelliteLink } from "@/lib/sso/satellite-links";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", href: "" },
  { label: "Brand DNA", href: "/brand-dna" },
  { label: "Calendar", href: "/calendar" },
  { label: "Articles", href: "/articles" },
  { label: "Analytics", href: "/analytics" },
  { label: "Keywords", href: "/keywords" },
  { label: "API", href: "/api" }
];

type SidebarNavProps = {
  siteId: string;
  satellites: SatelliteLink[];
};

export function SidebarNav({ siteId, satellites }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav className="space-y-2">
      {navItems.map((item) => {
        const href = `/${siteId}${item.href}`;
        const active = item.href ? pathname === href || pathname.startsWith(`${href}/`) : pathname === href;

        return (
          <Link
            key={item.label}
            href={href}
            className={cn(
              "flex items-center rounded-2xl px-4 py-3 text-sm font-medium transition hover:bg-slate-50 hover:text-ink dark:hover:bg-slate-800 dark:hover:text-slate-100",
              active
                ? "bg-slate-50 text-ink shadow-sm dark:bg-slate-800 dark:text-slate-100"
                : "text-slate-600 dark:text-slate-400"
            )}
          >
            {item.label}
          </Link>
        );
      })}
      {satellites.map((satellite) => (
        <a
          key={satellite.service}
          href={
            satellite.href.startsWith("/") ? `/${siteId}${satellite.href}` : satellite.href
          }
          className="flex items-center rounded-2xl px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-ink dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        >
          {satellite.label}
        </a>
      ))}
      <Link
        href={`/${siteId}/billing`}
        className={cn(
          "flex items-center rounded-2xl px-4 py-3 text-sm font-medium transition hover:bg-slate-50 hover:text-ink dark:hover:bg-slate-800 dark:hover:text-slate-100",
          pathname === `/${siteId}/billing` ? "bg-slate-50 text-ink shadow-sm dark:bg-slate-800 dark:text-slate-100" : "text-slate-600 dark:text-slate-400"
        )}
      >
        Billing
      </Link>
      <Link
        href={`/${siteId}/team`}
        className={cn(
          "flex items-center rounded-2xl px-4 py-3 text-sm font-medium transition hover:bg-slate-50 hover:text-ink dark:hover:bg-slate-800 dark:hover:text-slate-100",
          pathname === `/${siteId}/team` ? "bg-slate-50 text-ink shadow-sm dark:bg-slate-800 dark:text-slate-100" : "text-slate-600 dark:text-slate-400"
        )}
      >
        Team
      </Link>

      <Link
        href={`/${siteId}/settings`}
        className={cn(
          "mt-6 flex items-center rounded-2xl px-4 py-3 text-sm font-medium transition hover:bg-slate-50 hover:text-ink dark:hover:bg-slate-800 dark:hover:text-slate-100",
          pathname === `/${siteId}/settings`
            ? "bg-slate-50 text-ink shadow-sm dark:bg-slate-800 dark:text-slate-100"
            : "text-slate-600 dark:text-slate-400"
        )}
      >
        Settings
      </Link>
    </nav>
  );
}
