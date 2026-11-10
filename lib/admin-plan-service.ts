// Transactional core of the admin plan actions, over a minimal tx-like interface
// so it can be unit-tested without a database.
import {
  decideExtendTrial,
  decideGrantComp,
  decideRevokeComp,
  type Decision,
  type WorkspaceState
} from "@/lib/admin-plan-rules";

export type PlanAction = "GRANT_COMP" | "REVOKE_COMP" | "EXTEND_TRIAL";

export type AuditRow = {
  opId: string;
  actorUserId: string;
  actorEmail: string;
  workspaceId: string;
  action: PlanAction;
  before: { plan: string; trialEndsAt: string | null };
  after: { plan: string; trialEndsAt: string | null; days?: number };
};

export type PlanTx = {
  lock(workspaceId: string): Promise<void>;
  findWorkspace(workspaceId: string): Promise<WorkspaceState | null>;
  updateWorkspace(workspaceId: string, data: { plan: string; trialEndsAt: Date | null }): Promise<void>;
  findAudit(opId: string): Promise<{ action: string; workspaceId: string; after: unknown } | null>;
  createAudit(row: AuditRow): Promise<void>;
};

export type PlanChangeInput = {
  workspaceId: string;
  action: PlanAction;
  opId: string;
  days?: number;
  actor: { id: string; email: string };
  now: Date;
};

export type PlanChangeResult = { error?: string; success?: string };

function formatDay(iso: string | null | undefined) {
  if (!iso) return "-";
  return new Date(iso).toISOString().slice(0, 10);
}

function messageFor(action: string, after: unknown): string {
  const a = (after ?? {}) as { trialEndsAt?: string | null };
  if (action === "GRANT_COMP") return "COMP plan granted.";
  if (action === "REVOKE_COMP") return "COMP plan revoked.";
  return `Trial extended until ${formatDay(a.trialEndsAt)}.`;
}

export async function applyPlanChange(tx: PlanTx, input: PlanChangeInput): Promise<PlanChangeResult> {
  await tx.lock(input.workspaceId);

  const existing = await tx.findAudit(input.opId);
  if (existing) {
    if (existing.workspaceId !== input.workspaceId || existing.action !== input.action) {
      return { error: "Invalid request." };
    }
    return { success: messageFor(existing.action, existing.after) };
  }

  const ws = await tx.findWorkspace(input.workspaceId);
  if (!ws) return { error: "Workspace not found." };

  let decision: Decision;
  if (input.action === "GRANT_COMP") decision = decideGrantComp(ws);
  else if (input.action === "REVOKE_COMP") decision = decideRevokeComp(ws, input.now);
  else decision = decideExtendTrial(ws, input.days ?? NaN, input.now);

  if (!decision.ok) return { error: decision.reason };

  await tx.updateWorkspace(input.workspaceId, { plan: decision.plan, trialEndsAt: decision.trialEndsAt });

  const after: AuditRow["after"] = {
    plan: decision.plan,
    trialEndsAt: decision.trialEndsAt ? decision.trialEndsAt.toISOString() : null
  };
  if (input.action === "EXTEND_TRIAL") after.days = input.days;

  await tx.createAudit({
    opId: input.opId,
    actorUserId: input.actor.id,
    actorEmail: input.actor.email,
    workspaceId: input.workspaceId,
    action: input.action,
    before: { plan: ws.plan, trialEndsAt: ws.trialEndsAt ? ws.trialEndsAt.toISOString() : null },
    after
  });

  return { success: messageFor(input.action, after) };
}
