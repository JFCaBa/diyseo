import Link from "next/link";
import { redirect } from "next/navigation";

import { RemoveMemberButton, RevokeInviteButton, TeamInviteForm } from "@/components/team-forms";
import { prisma } from "@/lib/prisma";
import { listTeam } from "@/lib/teams";
import { requireWorkspace } from "@/lib/workspace-context";

export const dynamic = "force-dynamic";

function formatDate(value: Date) {
  return value.toLocaleDateString("en-GB", { dateStyle: "medium" });
}

export default async function TeamPage() {
  const member = await requireWorkspace().catch(() => null);

  if (!member) {
    redirect("/");
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: member.workspaceId },
    select: { name: true, sites: { orderBy: { createdAt: "asc" }, select: { id: true }, take: 1 } }
  });

  if (!workspace) {
    redirect("/");
  }

  const isOwner = member.role === "OWNER";
  const team = await listTeam(member.workspaceId);
  const now = new Date();
  const firstSiteId = workspace.sites[0]?.id;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">Team</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">{workspace.name}</h1>
        </div>
        <Link href={firstSiteId ? `/${firstSiteId}` : "/new-site"} className="text-sm font-semibold text-accent hover:underline">
          {firstSiteId ? "Back to your site" : "Create your first site"}
        </Link>
      </div>

      {isOwner ? (
        <section className="mt-8 rounded-2xl border border-line bg-white px-5 py-5">
          <h2 className="text-lg font-semibold text-ink">Invite a teammate</h2>
          <p className="mt-1 text-sm text-slate-600">
            They sign in with Google using this email and get access to every site in this workspace.
          </p>
          <div className="mt-4">
            <TeamInviteForm />
          </div>
        </section>
      ) : null}

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-ink">Members</h2>
        <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-white">
          {team.members.map((person) => (
            <li key={person.userId} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{person.name || person.email}</p>
                {person.name ? <p className="truncate text-xs text-slate-600">{person.email}</p> : null}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  {person.role === "OWNER" ? "Owner" : "Member"}
                </span>
                {isOwner && person.role !== "OWNER" ? <RemoveMemberButton userId={person.userId} label={person.name || person.email} /> : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {team.invites.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-ink">Invites</h2>
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-white">
            {team.invites.map((invite) => {
              const expired = invite.expiresAt.getTime() <= now.getTime();

              return (
                <li key={invite.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{invite.email}</p>
                    <p className="text-xs text-slate-600">
                      {expired ? `Expired ${formatDate(invite.expiresAt)}` : `Pending, expires ${formatDate(invite.expiresAt)}`}
                    </p>
                  </div>
                  {isOwner ? <RevokeInviteButton inviteId={invite.id} /> : null}
                </li>
              );
            })}
          </ul>
          {isOwner ? (
            <p className="mt-2 text-xs text-slate-600">To send a fresh link, invite the same email again.</p>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
