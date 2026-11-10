import "server-only";

import { notFound } from "next/navigation";
import { cache } from "react";

import { isAdminEmail } from "@/lib/admin-access";
import { auth } from "@/lib/auth";

export type AdminUser = { id: string; email: string };

/** The signed-in admin, or null. Admin = Google session whose email is in ADMIN_EMAILS. */
// cache(): auth() runs once per request render (layout + page share it); outside a render it just calls through.
export const getAdmin = cache(async (): Promise<AdminUser | null> => {
  const session = await auth();
  const id = session?.user?.id;
  const email = session?.user?.email;

  if (!id || !email || !isAdminEmail(email)) {
    return null;
  }

  return { id, email };
});

/** Pages and layouts: anyone else gets a 404, so /admin does not reveal itself. */
export async function requireAdmin(): Promise<AdminUser> {
  const admin = await getAdmin();

  if (!admin) {
    notFound();
  }

  return admin;
}

/** Server actions: throws instead of redirecting. */
export async function requireAdminAction(): Promise<AdminUser> {
  const admin = await getAdmin();

  if (!admin) {
    throw new Error("Forbidden");
  }

  return admin;
}

/** Route handlers: returns a 404 Response for non-admins, the admin otherwise. */
export async function adminRouteGuard(): Promise<AdminUser | Response> {
  const admin = await getAdmin();

  if (!admin) {
    return new Response("Not found", { status: 404 });
  }

  return admin;
}
