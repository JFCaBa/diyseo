"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { inviteMember, removeTeamMember, revokeTeamInvite, type TeamActionState } from "@/lib/team-actions";

const initialState: TeamActionState = {};

function SubmitButton({ idle, busy, className }: { idle: string; busy: string; className: string }) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} className={`${className} disabled:cursor-not-allowed disabled:opacity-70`}>
      {pending ? busy : idle}
    </button>
  );
}

function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <input
        readOnly
        value={url}
        onFocus={(event) => event.currentTarget.select()}
        className="min-w-0 flex-1 rounded-xl border border-line bg-white px-3 py-2 font-mono text-xs text-ink"
        aria-label="Invite link"
      />
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
        className="rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold text-ink hover:bg-mist"
      >
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}

const EMAIL_STATUS: Record<"sent" | "not_configured" | "failed", string> = {
  sent: "We emailed the invite. You can also share this link:",
  not_configured: "Email is not set up, so share this link with them:",
  failed: "We could not send the email. Share this link with them:"
};

export function TeamInviteForm() {
  const [state, formAction] = useActionState(inviteMember, initialState);

  return (
    <div>
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm text-slate-600">
          Email
          <input
            type="email"
            name="email"
            required
            maxLength={254}
            placeholder="teammate@example.com"
            className="rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink"
          />
        </label>
        <SubmitButton
          idle="Invite"
          busy="Inviting..."
          className="min-h-10 rounded-xl bg-ink px-5 text-sm font-semibold text-white hover:bg-slate-800"
        />
      </form>

      {state.error ? (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      {state.limit !== undefined ? (
        <p role="alert" className="mt-3 text-sm text-amber-900">
          Your plan includes {state.limit} team {state.limit === 1 ? "member" : "members"}. Upgrade in{" "}
          <Link href="/billing" className="font-semibold text-accent hover:underline">
            Billing
          </Link>
          .
        </p>
      ) : null}

      {state.invite ? (
        <div role="status" className="mt-4 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">
          <p>
            Invite created for <strong>{state.invite.email}</strong>. {EMAIL_STATUS[state.invite.emailStatus]}
          </p>
          <CopyLink url={state.invite.url} />
          <p className="mt-2 text-xs">The link works once and expires in 7 days.</p>
        </div>
      ) : null}
    </div>
  );
}

export function RemoveMemberButton({ userId, label }: { userId: string; label: string }) {
  const [state, formAction] = useActionState(removeTeamMember, initialState);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm(`Remove ${label} from the team? They are signed out right away.`)) event.preventDefault();
      }}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="userId" value={userId} />
      <SubmitButton
        idle="Remove"
        busy="Removing..."
        className="rounded-xl border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50"
      />
      {state.error ? <p className="text-xs text-red-700">{state.error}</p> : null}
    </form>
  );
}

export function RevokeInviteButton({ inviteId }: { inviteId: string }) {
  const [state, formAction] = useActionState(revokeTeamInvite, initialState);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="inviteId" value={inviteId} />
      <SubmitButton
        idle="Revoke"
        busy="Revoking..."
        className="rounded-xl border border-line px-3 py-1.5 text-sm font-semibold text-ink hover:bg-mist"
      />
      {state.error ? <p className="text-xs text-red-700">{state.error}</p> : null}
    </form>
  );
}
