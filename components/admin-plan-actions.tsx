"use client";

import { useActionState, useEffect, useState } from "react";

import {
  adminExtendTrial,
  adminGrantComp,
  adminRevokeComp,
  type AdminPlanActionState
} from "@/app/admin/actions";
import { decideExtendTrial, decideGrantComp, decideRevokeComp, EXTEND_PRESETS } from "@/lib/admin-plan-rules";

type AdminPlanActionsProps = {
  workspaceId: string;
  userId: string;
  plan: string;
  effectivePlan: string;
  trialEndsAt: string | null;
  subscriptionStatus: string | null;
  isMemberView: boolean;
  nowIso: string;
};

const initialState: AdminPlanActionState = {};

// A fresh operation id per form, generated on the client only (never during
// server render), and regenerated after a success so the next action is new.
function useOpId(state: AdminPlanActionState) {
  const [opId, setOpId] = useState("");
  useEffect(() => {
    setOpId(crypto.randomUUID());
  }, [state]);
  return opId;
}

function ConfirmButton({
  label,
  disabled,
  state
}: {
  label: string;
  disabled: boolean;
  state: AdminPlanActionState;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    setArmed(false);
  }, [state]);

  return (
    <button
      type="submit"
      disabled={disabled}
      onClick={(event) => {
        if (!armed) {
          event.preventDefault();
          setArmed(true);
        }
      }}
      onBlur={() => setArmed(false)}
      className={`inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
        armed ? "bg-amber-500 text-slate-950 hover:bg-amber-400" : "bg-teal-600 text-white hover:bg-teal-500"
      }`}
    >
      {armed ? "Confirm" : label}
    </button>
  );
}

function Feedback({ state }: { state: AdminPlanActionState }) {
  return (
    <>
      {state.error ? <p className="text-xs text-red-400">{state.error}</p> : null}
      {state.success ? <p className="text-xs text-teal-400">{state.success}</p> : null}
    </>
  );
}

export function AdminPlanActions(props: AdminPlanActionsProps) {
  const { workspaceId, userId, plan, effectivePlan, trialEndsAt, subscriptionStatus, isMemberView, nowIso } = props;
  const now = new Date(nowIso);
  const ws = { plan, trialEndsAt: trialEndsAt ? new Date(trialEndsAt) : null, subscriptionStatus };

  const grant = decideGrantComp(ws);
  const revoke = decideRevokeComp(ws, now);
  const extend = decideExtendTrial(ws, EXTEND_PRESETS[0], now);

  const [grantState, grantAction] = useActionState(adminGrantComp, initialState);
  const [revokeState, revokeAction] = useActionState(adminRevokeComp, initialState);
  const grantOp = useOpId(grantState);
  const revokeOp = useOpId(revokeState);

  const incompleteStripe = subscriptionStatus !== null && subscriptionStatus !== "canceled";
  const hidden = (opId: string) => (
    <>
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="opId" value={opId} />
    </>
  );

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-300">
        Stored plan <span className="font-semibold text-white">{plan}</span>, effective plan{" "}
        <span className="font-semibold text-white">{effectivePlan}</span>.
      </p>
      {isMemberView ? (
        <p className="text-xs text-amber-300">
          This user is a member, not the owner. These actions apply to the whole workspace they belong to.
        </p>
      ) : null}

      {plan === "COMP" ? (
        <form action={revokeAction} className="space-y-2">
          {hidden(revokeOp)}
          <div className="flex flex-wrap items-center gap-3">
            <ConfirmButton label="Revoke COMP" disabled={!revokeOp || !revoke.ok} state={revokeState} />
            {!revoke.ok ? <span className="text-xs text-slate-400">{revoke.reason}</span> : null}
          </div>
          <Feedback state={revokeState} />
        </form>
      ) : (
        <form action={grantAction} className="space-y-2">
          {hidden(grantOp)}
          <div className="flex flex-wrap items-center gap-3">
            <ConfirmButton label="Give COMP plan" disabled={!grantOp || !grant.ok} state={grantState} />
            {!grant.ok ? <span className="text-xs text-slate-400">{grant.reason}</span> : null}
            {grant.ok && incompleteStripe ? (
              <span className="text-xs text-amber-300">
                Stripe shows status {subscriptionStatus}; if that subscription completes the customer will still be
                billed.
              </span>
            ) : null}
          </div>
          <Feedback state={grantState} />
        </form>
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-200">Extend trial</h3>
        <div className="flex flex-wrap gap-4">
          {EXTEND_PRESETS.map((days) => (
            <ExtendForm
              key={days}
              days={days}
              hidden={hidden}
              disabled={!extend.ok}
            />
          ))}
        </div>
        {!extend.ok ? <p className="text-xs text-slate-400">{extend.reason}</p> : null}
      </div>
    </div>
  );
}

function ExtendForm({
  days,
  hidden,
  disabled
}: {
  days: number;
  hidden: (opId: string) => React.ReactNode;
  disabled: boolean;
}) {
  const [state, formAction] = useActionState(adminExtendTrial, initialState);
  const opId = useOpId(state);

  return (
    <form action={formAction} className="space-y-2">
      {hidden(opId)}
      <input type="hidden" name="days" value={days} />
      <ConfirmButton label={`Extend ${days} days`} disabled={!opId || disabled} state={state} />
      <Feedback state={state} />
    </form>
  );
}
