import Link from "next/link";
import { notFound } from "next/navigation";

import { requireAdmin } from "@/lib/admin-auth";
import { effectivePlan, monthStartUtc } from "@/lib/entitlements";
import { prisma } from "@/lib/prisma";

function formatDate(value: Date | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric" }).format(value);
}

function formatDateTime(value: Date | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(value) + " UTC";
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-sm text-slate-200">{children}</dd>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default async function AdminUserPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();

  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      // Never select access_token / refresh_token / id_token.
      accounts: { select: { provider: true } },
      workspace: { select: { id: true } },
      membership: { select: { role: true, workspaceId: true } }
    }
  });

  if (!user) {
    notFound();
  }

  // The owned workspace, else the one the user is a member of.
  const workspaceId = user.workspace?.id ?? user.membership?.workspaceId ?? null;
  const now = new Date();

  const workspace = workspaceId
    ? await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: {
          id: true,
          name: true,
          plan: true,
          trialEndsAt: true,
          stripeCustomerId: true,
          subscriptionStatus: true,
          planSyncedAt: true,
          owner: { select: { id: true, email: true } },
          members: {
            orderBy: { createdAt: "asc" },
            select: { role: true, user: { select: { id: true, email: true, name: true } } }
          },
          sites: {
            orderBy: { createdAt: "desc" },
            select: { id: true, name: true, domain: true, _count: { select: { articles: true } } }
          }
        }
      })
    : null;

  const usage = workspace
    ? await prisma.aiUsage.groupBy({
        by: ["kind"],
        where: { workspaceId: workspace.id, status: "COMMITTED", createdAt: { gte: monthStartUtc(now) } },
        _count: { _all: true },
        orderBy: { kind: "asc" }
      })
    : [];

  const role = user.workspace ? "OWNER" : (user.membership?.role ?? null);
  const providers = Array.from(new Set(user.accounts.map((a) => a.provider)));

  return (
    <section className="space-y-6">
      <div className="border-b border-slate-800 pb-6">
        <Link href="/admin/users" className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-400 hover:text-teal-300">
          Admin / Users
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">{user.email || "No email"}</h1>
      </div>

      <Card title="Account">
        <dl className="grid gap-4 sm:grid-cols-2">
          <Field label="Email">{user.email || "-"}</Field>
          <Field label="Name">{user.name || "-"}</Field>
          <Field label="Created">{formatDate(user.createdAt)}</Field>
          <Field label="Sign-in provider">{providers.length ? providers.join(", ") : "-"}</Field>
        </dl>
      </Card>

      <Card title="Workspace">
        {workspace ? (
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label="Name">{workspace.name}</Field>
            <Field label="This user's role">{role ?? "-"}</Field>
            <Field label="Owner">
              {workspace.owner.id === user.id ? (
                "This user"
              ) : (
                <Link href={`/admin/users/${workspace.owner.id}`} className="text-teal-300 hover:text-teal-200">
                  {workspace.owner.email || workspace.owner.id}
                </Link>
              )}
            </Field>
            <Field label="Stored plan">{workspace.plan}</Field>
            <Field label="Effective plan">{effectivePlan(workspace, now)}</Field>
            <Field label="Trial ends">{formatDate(workspace.trialEndsAt)}</Field>
            <Field label="Subscription status">{workspace.subscriptionStatus ?? "-"}</Field>
            <Field label="Stripe customer">
              {workspace.stripeCustomerId ? (
                <a
                  href={`https://dashboard.stripe.com/customers/${encodeURIComponent(workspace.stripeCustomerId)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-teal-300 hover:text-teal-200"
                >
                  {workspace.stripeCustomerId}
                </a>
              ) : (
                "-"
              )}
            </Field>
            <Field label="Last plan sync">{formatDateTime(workspace.planSyncedAt)}</Field>
          </dl>
        ) : (
          <p className="text-sm text-slate-400">This user has no workspace.</p>
        )}
      </Card>

      {/* TODO(Task 6): plan actions for workspace `workspace.id` go here, beneath the workspace section. */}

      {workspace ? (
        <>
          <Card title="Members">
            <ul className="divide-y divide-slate-800 text-sm text-slate-300">
              {workspace.members.map((member) => (
                <li key={member.user.id} className="flex items-center justify-between gap-3 py-2">
                  <Link href={`/admin/users/${member.user.id}`} className="truncate text-teal-300 hover:text-teal-200">
                    {member.user.email || member.user.name || member.user.id}
                  </Link>
                  <span className="text-xs text-slate-500">{member.role}</span>
                </li>
              ))}
              {workspace.members.length === 0 ? <li className="py-2 text-slate-400">No members.</li> : null}
            </ul>
          </Card>

          <Card title="AI usage this month">
            {usage.length === 0 ? (
              <p className="text-sm text-slate-400">No committed AI usage this month.</p>
            ) : (
              <ul className="divide-y divide-slate-800 text-sm text-slate-300">
                {usage.map((row) => (
                  <li key={row.kind} className="flex justify-between py-2">
                    <span>{row.kind}</span>
                    <span className="tabular-nums">{row._count._all}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Sites">
            <ul className="divide-y divide-slate-800 text-sm text-slate-300">
              {workspace.sites.map((site) => (
                <li key={site.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="truncate">
                    {site.name} <span className="text-slate-500">{site.domain}</span>
                  </span>
                  <span className="text-xs text-slate-500">
                    {site._count.articles} {site._count.articles === 1 ? "article" : "articles"}
                  </span>
                </li>
              ))}
              {workspace.sites.length === 0 ? <li className="py-2 text-slate-400">No sites.</li> : null}
            </ul>
          </Card>
        </>
      ) : null}
    </section>
  );
}
