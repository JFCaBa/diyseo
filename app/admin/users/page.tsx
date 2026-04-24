import { requireAdminAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(value);
}

export default async function AdminUsersPage() {
  await requireAdminAuth();

  const users = await prisma.user.findMany({
    orderBy: {
      createdAt: "desc"
    },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      workspace: {
        select: {
          id: true,
          _count: {
            select: {
              sites: true
            }
          }
        }
      }
    }
  });

  return (
    <section className="space-y-6">
      <div className="border-b border-slate-800 pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-400">Admin</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Users</h1>
        <p className="mt-1 text-sm text-slate-400">Read-only user list with workspace and site counts.</p>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/80 shadow-2xl">
        <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_120px_120px_120px] gap-3 border-b border-slate-800 bg-slate-950/70 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <p>Email</p>
          <p>Name</p>
          <p>Created</p>
          <p>Workspaces</p>
          <p>Sites</p>
        </div>
        <div className="divide-y divide-slate-800">
          {users.map((user) => (
            <div
              key={user.id}
              className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_120px_120px_120px] gap-3 px-4 py-4 text-sm text-slate-300"
            >
              <p className="truncate">{user.email || "No email"}</p>
              <p className="truncate">{user.name || "Unknown"}</p>
              <p>{formatDate(user.createdAt)}</p>
              <p>{user.workspace ? 1 : 0}</p>
              <p>{user.workspace?._count.sites ?? 0}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
