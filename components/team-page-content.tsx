import { redirect } from "next/navigation";

import { ChangeRoleButton, RemoveMemberButton, RevokeInviteButton, TeamInviteForm } from "@/components/team-forms";
import { getT, getUiLocale } from "@/lib/i18n/server";
import { formatDateMedium } from "@/lib/i18n/translate";
import { prisma } from "@/lib/prisma";
import { listTeam } from "@/lib/teams";
import { requireWorkspace } from "@/lib/workspace-context";

/** The team page body, rendered inside the site layout (or standalone when the workspace has no site). */
export async function TeamPageContent() {
  const t = await getT();
  const locale = await getUiLocale();
  const member = await requireWorkspace().catch(() => null);

  if (!member) {
    redirect("/");
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: member.workspaceId },
    select: { name: true }
  });

  if (!workspace) {
    redirect("/");
  }

  const isOwner = member.role === "OWNER";
  const team = await listTeam(member.workspaceId);
  // Only the main owner (billing holder) appoints or revokes co-owners; a co-owner can only step down.
  const isPrimary = member.userId === team.primaryOwnerId;
  const now = new Date();

  return (
    <div className="mx-auto max-w-5xl">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">{t("nav.team")}</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">{workspace.name}</h1>
      </div>

      {isOwner ? (
        <section className="mt-8 rounded-2xl border border-line bg-white px-5 py-5">
          <h2 className="text-lg font-semibold text-ink">{t("team.inviteTitle")}</h2>
          <p className="mt-1 text-sm text-slate-600">{t("team.inviteIntro")}</p>
          <div className="mt-4">
            <TeamInviteForm />
          </div>
        </section>
      ) : null}

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-ink">{t("team.members")}</h2>
        <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-white">
          {team.members.map((person) => (
            <li key={person.userId} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{person.name || person.email}</p>
                {person.name ? <p className="truncate text-xs text-slate-600">{person.email}</p> : null}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  {person.role === "MEMBER"
                    ? t("team.roleMember")
                    : person.userId === team.primaryOwnerId && team.members.some((m) => m.role === "OWNER" && m.userId !== team.primaryOwnerId)
                      ? t("team.roleMainOwner")
                      : t("team.roleOwner")}
                </span>
                {isPrimary && person.role === "MEMBER" ? (
                  <ChangeRoleButton userId={person.userId} role="OWNER" label={person.name || person.email} />
                ) : null}
                {isOwner && person.role === "OWNER" && person.userId !== team.primaryOwnerId && (isPrimary || person.userId === member.userId) ? (
                  <ChangeRoleButton userId={person.userId} role="MEMBER" label={person.name || person.email} />
                ) : null}
                {isOwner && person.role !== "OWNER" ? <RemoveMemberButton userId={person.userId} label={person.name || person.email} /> : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {team.invites.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-ink">{t("team.invites")}</h2>
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-white">
            {team.invites.map((invite) => {
              const expired = invite.expiresAt.getTime() <= now.getTime();

              return (
                <li key={invite.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{invite.email}</p>
                    <p className="text-xs text-slate-600">
                      {t(expired ? "team.expired" : "team.pending", { date: formatDateMedium(invite.expiresAt, locale) })}
                    </p>
                  </div>
                  {isOwner ? <RevokeInviteButton inviteId={invite.id} /> : null}
                </li>
              );
            })}
          </ul>
          {isOwner ? (
            <p className="mt-2 text-xs text-slate-600">{t("team.freshLink")}</p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
