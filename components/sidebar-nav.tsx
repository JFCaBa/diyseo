"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", href: "" },
  { label: "Brand DNA", href: "/brand-dna" },
  { label: "Calendar", href: "/calendar" },
  { label: "Articles", href: "/articles" },
  { label: "Analytics", href: "/analytics" },
  { label: "Keywords", href: "/keywords" }
];

type SidebarNavProps = {
  siteId: string;
};

export function SidebarNav({ siteId }: SidebarNavProps) {
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
              "flex items-center rounded-2xl px-4 py-3 text-sm font-medium transition hover:bg-white hover:text-ink",
              active ? "bg-white text-ink shadow-sm" : "text-slate-600"
            )}
          >
            {item.label}
          </Link>
        );
      })}

      <Link
        href="/settings"
        className={cn(
          "mt-6 flex items-center rounded-2xl px-4 py-3 text-sm font-medium transition hover:bg-white hover:text-ink",
          pathname === "/settings" ? "bg-white text-ink shadow-sm" : "text-slate-600"
        )}
      >
        Settings
      </Link>
    </nav>
  );
}
