"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAppOrigin } from "@/lib/app-origin";
import { auth } from "@/lib/auth";
import { effectivePlan } from "@/lib/entitlements";
import { INVITE_RATE_LIMITED, inviteAllowed } from "@/lib/invite-limits";
import { sendInviteEmail } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";
import { memberLimit } from "@/lib/satellite-entitlements";
import { releaseStaleCheckout } from "@/lib/stale-checkout";
import { acceptInvite, createInvite, inviteForToken, removeMember, revokeInvite } from "@/lib/teams";
import { inviteMemberSchema } from "@/lib/validations";
import { requireOwner } from "@/lib/workspace-context";

export type TeamActionState = {
  error?: string;
  /** Set when the plan's member limit is reached: the limit, for the upgrade message. */
  limit?: number;
  invite?: { email: string; url: string; emailStatus: "sent" | "not_configured" | "failed" };
};

const RETRY_MESSAGE = "Something went wrong, please try again.";
const OWNER_ONLY = "Only the workspace owner can manage the team.";

/** The OWNER's identity from the session, or null for anyone else. Never taken from the client. */
async function ownerOrNull() {
  return requireOwner().catch((error: unknown) => {
    if (error instanceof Error && (error.message === "Unauthorized" || error.message === "Forbidden")) return null;
    throw error;
  });
}

export async function inviteMember(_prevState: TeamActionState, formData: FormData): Promise<TeamActionState> {
  const owner = await ownerOrNull();
  if (!owner) return { error: OWNER_ONLY };

  const parsed = inviteMemberSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Enter a valid email." };
  }
  const email = parsed.data.email;
  const now = new Date();

  // Before anything is created or sent: a limited request changes nothing.
  if (!inviteAllowed(owner.workspaceId, email, now.getTime())) {
    return { error: INVITE_RATE_LIMITED };
  }

  let result: Awaited<ReturnType<typeof createInvite>>;
  try {
    result = await createInvite(owner.workspaceId, owner.userId, email, now);
  } catch (error) {
    console.error("team_invite_failed", { code: (error as { code?: string }).code ?? "unknown" });
    return { error: RETRY_MESSAGE };
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: owner.workspaceId },
    select: { name: true, plan: true, trialEndsAt: true }
  });
  if (!workspace) return { error: RETRY_MESSAGE };

  if ("error" in result) {
    if (result.error === "already_member") return { error: `${email} is already on this team.` };
    return { limit: memberLimit(effectivePlan(workspace, now)) ?? 0 };
  }

  const url = `${getAppOrigin()}/invite/${result.token}`;
  let emailStatus: "sent" | "not_configured" | "failed";
  try {
    emailStatus = await sendInviteEmail(email, url, workspace.name);
  } catch (error) {
    console.error("team_invite_email_failed", { code: (error as { code?: string }).code ?? "unknown" });
    emailStatus = "failed";
  }

  revalidatePath("/team");
  revalidatePath("/[siteId]/team", "page");
  return { invite: { email, url, emailStatus } };
}

export async function removeTeamMember(_prevState: TeamActionState, formData: FormData): Promise<TeamActionState> {
  const owner = await ownerOrNull();
  if (!owner) return { error: OWNER_ONLY };

  const userId = formData.get("userId");
  if (typeof userId !== "string" || !userId || userId === owner.userId) {
    return { error: "The owner cannot be removed." };
  }

  try {
    await removeMember(owner.workspaceId, userId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "Not found") return { error: "That person is no longer on this team." };
    if (message === "The owner cannot be removed.") return { error: message };
    console.error("team_remove_failed", { code: (error as { code?: string }).code ?? "unknown" });
    return { error: RETRY_MESSAGE };
  }

  revalidatePath("/team");
  revalidatePath("/[siteId]/team", "page");
  return {};
}

export async function revokeTeamInvite(_prevState: TeamActionState, formData: FormData): Promise<TeamActionState> {
  const owner = await ownerOrNull();
  if (!owner) return { error: OWNER_ONLY };

  const inviteId = formData.get("inviteId");
  if (typeof inviteId !== "string" || !inviteId) return { error: RETRY_MESSAGE };

  try {
    await revokeInvite(owner.workspaceId, inviteId);
  } catch (error) {
    console.error("team_revoke_failed", { code: (error as { code?: string }).code ?? "unknown" });
    return { error: RETRY_MESSAGE };
  }

  revalidatePath("/team");
  revalidatePath("/[siteId]/team", "page");
  return {};
}

/**
 * Joins the signed-in user to the invite's workspace. The outcome is shown by
 * the invite page: success goes into the app, any refusal comes back as ?error=.
 */
export async function acceptTeamInvite(token: string): Promise<void> {
  const invitePath = `/invite/${encodeURIComponent(token)}`;
  const session = await auth();
  const userId = session?.user?.id;
  const email = session?.user?.email;

  if (!userId || !email) {
    redirect(invitePath);
  }

  // An abandoned Checkout on the user's own workspace must not block joining.
  // Only for a usable invite to this email, so a bad link never touches billing.
  const now = new Date();
  const invite = await inviteForToken(token, now).catch(() => null);
  if (invite?.usable && invite.email === email.trim().toLowerCase()) {
    await releaseStaleCheckout(userId).catch((error: unknown) => {
      console.error("team_stale_checkout_failed", { code: (error as { code?: string }).code ?? "unknown" });
    });
  }

  let result: Awaited<ReturnType<typeof acceptInvite>>;
  try {
    result = await acceptInvite(token, { id: userId, email }, now);
  } catch (error) {
    console.error("team_accept_failed", { code: (error as { code?: string }).code ?? "unknown" });
    redirect(`${invitePath}?error=retry`);
  }

  if ("error" in result) {
    redirect(result.error === "already_member" ? "/" : `${invitePath}?error=${result.error}`);
  }

  revalidatePath("/", "layout");
  redirect("/auth/continue");
}
