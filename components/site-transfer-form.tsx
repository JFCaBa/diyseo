"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { transferSite, type ActionState } from "@/lib/actions";

const initialState: ActionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-2xl border border-line px-4 py-3 text-sm font-semibold text-ink transition hover:bg-mist disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Transferring..." : "Transfer site"}
    </button>
  );
}

type SiteTransferFormProps = {
  siteId: string;
};

export function SiteTransferForm({ siteId }: SiteTransferFormProps) {
  const transferSiteForCurrentSite = transferSite.bind(null, siteId);
  const [state, formAction] = useActionState(transferSiteForCurrentSite, initialState);

  return (
    <form action={formAction} className="mt-4 grid gap-3 rounded-2xl border border-line bg-white/70 p-4">
      <div>
        <p className="text-sm font-semibold text-ink">Transfer site</p>
        <p className="mt-1 text-xs text-slate-500">
          Move this site to another existing user by email. You will lose access immediately after the transfer.
        </p>
      </div>

      <div className="grid gap-2">
        <label htmlFor={`transfer-email-${siteId}`} className="text-sm font-medium text-ink">
          Target user email
        </label>
        <input
          id={`transfer-email-${siteId}`}
          name="email"
          type="email"
          placeholder="user@example.com"
          className="rounded-2xl border border-line px-4 py-3 outline-none transition focus:border-accent"
          required
        />
      </div>

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-accent">{state.success}</p> : null}

      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}
