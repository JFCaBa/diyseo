/**
 * Who may change whose role. The workspace's primary owner (the billing holder, mirrored in the workspace row); other OWNER members are
 * co-owners. Only the primary owner appoints or revokes co-owners, a co-owner may step down on their own, and the
 * primary owner's role never changes.
 */
export type TeamRole = "OWNER" | "MEMBER";

export type RoleChangeError = "unchanged" | "primary_owner" | "primary_only";

export function canChangeRole(input: {
  actorUserId: string;
  primaryOwnerId: string;
  targetUserId: string;
  targetRole: TeamRole;
  nextRole: TeamRole;
}): { ok: true } | { ok: false; error: RoleChangeError } {
  const { actorUserId, primaryOwnerId, targetUserId, targetRole, nextRole } = input;
  if (targetUserId === primaryOwnerId) return { ok: false, error: "primary_owner" };
  if (nextRole === targetRole) return { ok: false, error: "unchanged" };
  const actorIsPrimary = actorUserId === primaryOwnerId;
  const steppingDown = nextRole === "MEMBER" && actorUserId === targetUserId;
  if (!actorIsPrimary && !steppingDown) return { ok: false, error: "primary_only" };
  return { ok: true };
}

export const ROLE_ERRORS: Record<RoleChangeError, string> = {
  unchanged: "That person already has this role.",
  primary_owner: "The workspace's main owner cannot change role.",
  primary_only: "Only the main owner can make someone an owner or remove an owner."
};
