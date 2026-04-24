import type { ReactNode } from "react";
import Link from "next/link";

import { AdminLogoutForm } from "@/components/admin-logout-form";

type AdminShellProps = {
  children: ReactNode;
};

const navItems = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/sites", label: "Sites" },
  { href: "/admin/content", label: "Content" },
  { href: "/admin/backups", label: "Backups" }
];

export function AdminShell({ children }: AdminShellProps) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-b border-slate-800 bg-slate-950/95 p-6 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-teal-400">DIYSEO</p>
          <h1 className="mt-2 text-xl font-semibold text-white">Platform Admin</h1>
          <p className="mt-1 text-sm text-slate-400">Internal read-only operations area.</p>
        </div>

        <nav className="grid gap-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-2xl px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-slate-900 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-8">
          <AdminLogoutForm />
        </div>
      </aside>

      <main className="min-w-0 px-6 py-8 lg:px-8">{children}</main>
    </div>
  );
}
