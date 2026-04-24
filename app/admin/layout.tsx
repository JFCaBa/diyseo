import type { ReactNode } from "react";

import { AdminShell } from "@/components/admin-shell";
import { isAdminAuthenticated } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

type AdminLayoutProps = {
  children: ReactNode;
};

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const authenticated = await isAdminAuthenticated();

  if (!authenticated) {
    return <div className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">{children}</div>;
  }

  return <AdminShell>{children}</AdminShell>;
}
