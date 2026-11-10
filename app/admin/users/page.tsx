import Link from "next/link";

import { requireAdmin } from "@/lib/admin-auth";
import { effectivePlan } from "@/lib/entitlements";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 50;

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(value);
}

function parsePage(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const n = Number.parseInt(value ?? "", 10);
  return Number.isSafeInteger(n) && n > 0 ? n : 1;
}

const workspaceSelect = {
  plan: true,
  trialEndsAt: true,
  subscriptionStatus: true,
  _count: { select: { sites: true } }
} as const;

export default async function AdminUsersPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string | string[]; page?: string | string[] }>;
}) {
  await requireAdmin();

  const params = await searchParams;
  const rawQ = Array.isArray(params.q) ? params.q[0] : params.q;
  const q = (rawQ ?? "").trim().slice(0, 100);
  const requestedPage = parsePage(params.page);

  const where = q
    ? {
        OR: [
          { email: { contains: q, mode: "insensitive" as const } },
          { name: { contains: q, mode: "insensitive" as const } }
        ]
      }
    : {};

  const total = await prisma.user.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);

  const users = await prisma.user.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      workspace: { select: workspaceSelect },
      membership: { select: { workspace: { select: workspaceSelect } } }
    }
  });

  const now = new Date();
  const pageHref = (target: number) => {
    const search = new URLSearchParams();
    if (q) search.set("q", q);
    if (target > 1) search.set("page", String(target));
    const qs = search.toString();
    return qs ? `/admin/users?${qs}` : "/admin/users";
  };

  const cols = "grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_110px_90px_130px_60px]";

  return (
    <section className="space-y-6">
      <div className="border-b border-slate-800 pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-400">Admin</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Users</h1>
        <p className="mt-1 text-sm text-slate-400">
          {new Intl.NumberFormat("en-US").format(total)} {total === 1 ? "user" : "users"}
          {q ? ` matching "${q}"` : ""}
        </p>
      </div>

      <form method="get" action="/admin/users" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search by email or name"
          className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-teal-400 focus:outline-none"
        />
        <button type="submit" className="rounded-xl bg-teal-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-teal-400">
          Search
        </button>
        {q ? (
          <Link href="/admin/users" className="rounded-xl border border-slate-800 px-4 py-2 text-sm text-slate-300 hover:border-slate-600">
            Clear
          </Link>
        ) : null}
      </form>

      <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/80 shadow-2xl">
        <div className={`grid ${cols} gap-3 border-b border-slate-800 bg-slate-950/70 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500`}>
          <p>Email</p>
          <p>Name</p>
          <p>Created</p>
          <p>Plan</p>
          <p>Subscription</p>
          <p>Sites</p>
        </div>
        {users.length === 0 ? (
          <p className="px-4 py-8 text-sm text-slate-400">{q ? "No users match this search." : "No users yet."}</p>
        ) : (
          <div className="divide-y divide-slate-800">
            {users.map((user) => {
              const ws = user.workspace ?? user.membership?.workspace ?? null;
              return (
                <Link
                  key={user.id}
                  href={`/admin/users/${user.id}`}
                  className={`grid ${cols} gap-3 px-4 py-4 text-sm text-slate-300 hover:bg-slate-800/60`}
                >
                  <p className="truncate text-teal-300">{user.email || "No email"}</p>
                  <p className="truncate">{user.name || "Unknown"}</p>
                  <p>{formatDate(user.createdAt)}</p>
                  <p>
                    {ws ? effectivePlan(ws, now) : "-"}
                    {!user.workspace && ws ? <span className="text-slate-500"> (member)</span> : null}
                  </p>
                  <p className="truncate">{ws?.subscriptionStatus ?? "-"}</p>
                  <p>{ws?._count.sites ?? 0}</p>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {pageCount > 1 ? (
        <nav className="flex items-center justify-between text-sm text-slate-400">
          <span>
            Page {page} of {pageCount}
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link href={pageHref(page - 1)} className="rounded-xl border border-slate-800 px-3 py-1.5 hover:border-slate-600">
                Previous
              </Link>
            ) : null}
            {page < pageCount ? (
              <Link href={pageHref(page + 1)} className="rounded-xl border border-slate-800 px-3 py-1.5 hover:border-slate-600">
                Next
              </Link>
            ) : null}
          </div>
        </nav>
      ) : null}
    </section>
  );
}
