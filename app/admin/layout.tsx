import type { ReactNode } from "react";

import { AdminShell } from "@/components/admin-shell";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

type AdminLayoutProps = {
  children: ReactNode;
};

export default async function AdminLayout({ children }: AdminLayoutProps) {
  await requireAdmin();

  return <AdminShell>{children}</AdminShell>;
}
