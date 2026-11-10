import Link from "next/link";
import type { ReactNode } from "react";

import { requireAdmin } from "@/lib/admin-auth";
import { formatClock } from "@/lib/admin-format";
import { formatMinor } from "@/lib/admin-revenue";
import { getPaymentsOverview } from "@/lib/admin-stripe";
import { prisma } from "@/lib/prisma";

function formatDate(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "-";
}

function formatDateTime(value: Date) {
  return `${value.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

const card = "rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl";
const th = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500";
const td = "px-3 py-2 text-sm text-slate-300";

function Table({ title, empty, isEmpty, head, children }: { title: string; empty: string; isEmpty: boolean; head: string[]; children: ReactNode }) {
  return (
    <section className={card}>
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {isEmpty ? (
        <p className="mt-4 text-sm text-slate-500">{empty}</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr>
                {head.map((h) => (
                  <th key={h} className={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">{children}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default async function AdminPaymentsPage() {
  await requireAdmin();

  const overview = await getPaymentsOverview();

  const header = (
    <div className="border-b border-slate-800 pb-6">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-400">Admin</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Payments</h1>
      <p className="mt-1 text-sm text-slate-400">
        Read from Stripe: all subscriptions and charges of the last 30 days.
        {overview.ok ? <span className="ml-2 text-slate-500">Updated {formatClock(overview.fetchedAt)}</span> : null}
      </p>
    </div>
  );

  if (!overview.ok) {
    return (
      <section className="space-y-6">
        {header}
        <p className={`${card} text-sm text-slate-300`}>Stripe unavailable. Try again in a few minutes.</p>
      </section>
    );
  }

  const ids = [
    ...new Set(
      [...overview.subscriptions.map((s) => s.customerId), ...[...overview.charges, ...overview.failed].map((c) => c.customerId)].filter(
        (id): id is string => Boolean(id)
      )
    )
  ];

  const workspaces = ids.length
    ? await prisma.workspace.findMany({
        where: { stripeCustomerId: { in: ids } },
        select: { stripeCustomerId: true, owner: { select: { id: true, email: true } } }
      })
    : [];
  const owners = new Map(workspaces.map((w) => [w.stripeCustomerId, w]));

  const customer = (id: string | null) => {
    if (!id) return <span className="text-slate-500">-</span>;
    const ws = owners.get(id);
    if (!ws) return <span className="break-all">{id}</span>;
    return (
      <Link href={`/admin/users/${ws.owner.id}`} className="break-all text-teal-400 hover:underline">
        {ws.owner.email ?? ws.owner.id}
      </Link>
    );
  };

  const chargeRows = (rows: typeof overview.charges) =>
    rows.map((c) => (
      <tr key={c.id}>
        <td className={td}>{formatDateTime(c.created)}</td>
        <td className={td}>{customer(c.customerId)}</td>
        <td className={td}>{formatMinor(c.amount, c.currency)}</td>
        <td className={td}>
          {c.status}
          {c.refunded ? " (refunded)" : ""}
        </td>
        <td className={td}>{c.failureMessage ?? "-"}</td>
      </tr>
    ));
  const chargeHead = ["Date", "Customer", "Amount", "Status", "Failure"];

  return (
    <section className="space-y-6">
      {header}

      <Table
        title="Subscriptions"
        empty="No subscriptions."
        isEmpty={overview.subscriptions.length === 0}
        head={["Customer", "Plan", "Status", "Period end", "Cancels at period end"]}
      >
        {overview.subscriptions.map((s) => (
          <tr key={s.id}>
            <td className={td}>{customer(s.customerId)}</td>
            <td className={td}>
              {s.plan ?? "-"}
              {s.interval ? ` / ${s.interval}` : ""}
            </td>
            <td className={td}>{s.status}</td>
            <td className={td}>{formatDate(s.currentPeriodEnd)}</td>
            <td className={td}>{s.cancelAtPeriodEnd ? "Yes" : "No"}</td>
          </tr>
        ))}
      </Table>

      <Table title="Recent charges" empty="No charges in the last 30 days." isEmpty={overview.charges.length === 0} head={chargeHead}>
        {chargeRows(overview.charges)}
      </Table>

      <Table title="Failed payments (last 30 days)" empty="No failed payments in the last 30 days." isEmpty={overview.failed.length === 0} head={chargeHead}>
        {chargeRows(overview.failed)}
      </Table>
    </section>
  );
}
