"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { useLocalizeMessage, useT } from "@/components/i18n-provider";
import { inviteMember, removeTeamMember, revokeTeamInvite, setTeamMemberRole, type TeamActionState } from "@/lib/team-actions";

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
  const t = useT();
  const [copied, setCopied] = useState(false);

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <input
        readOnly
        value={url}
        onFocus={(event) => event.currentTarget.select()}
        className="min-w-0 flex-1 rounded-xl border border-line bg-white px-3 py-2 font-mono text-xs text-ink"
        aria-label={t("team.inviteLink")}
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
        {copied ? t("team.copied") : t("team.copyLink")}
      </button>
    </div>
  );
}

const EMAIL_STATUS_KEYS = {
  sent: "team.emailSent",
  not_configured: "team.emailNotConfigured",
  failed: "team.emailFailed"
} as const;

/** Splits a translated sentence around a `{name}` marker so a component can sit in the middle of it. */
function around(text: string, marker: string): [string, string] {
  const index = text.indexOf(marker);
  return index === -1 ? [text, ""] : [text.slice(0, index), text.slice(index + marker.length)];
}

export function TeamInviteForm() {
  const t = useT();
  const localizeMessage = useLocalizeMessage();
  const [state, formAction] = useActionState(inviteMember, initialState);
  const [limitBefore, limitAfter] = state.limit === undefined ? ["", ""] : around(t(state.limit === 1 ? "team.limitOne" : "team.limitOther", { limit: state.limit, billing: "{billing}" }), "{billing}");
  const [createdBefore, createdAfter] = state.invite ? around(t("team.inviteCreated", { email: "{email}" }), "{email}") : ["", ""];

  return (
    <div>
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm text-slate-600">
          {t("team.email")}
          <input
            type="email"
            name="email"
            required
            maxLength={254}
            placeholder={t("team.emailPlaceholder")}
            className="rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink"
          />
        </label>
        <SubmitButton
          idle={t("team.invite")}
          busy={t("team.inviting")}
          className="min-h-10 rounded-xl bg-ink px-5 text-sm font-semibold text-white hover:bg-slate-800"
        />
      </form>

      {state.error ? (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {localizeMessage(state.error)}
        </p>
      ) : null}

      {state.limit !== undefined ? (
        <p role="alert" className="mt-3 text-sm text-amber-900">
          {limitBefore}
          <Link href="/billing" className="font-semibold text-accent hover:underline">
            {t("nav.billing")}
          </Link>
          {limitAfter}
        </p>
      ) : null}

      {state.invite ? (
        <div role="status" className="mt-4 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">
          <p>
            {createdBefore}
            <strong>{state.invite.email}</strong>
            {createdAfter} {t(EMAIL_STATUS_KEYS[state.invite.emailStatus])}
          </p>
          <CopyLink url={state.invite.url} />
          <p className="mt-2 text-xs">{t("team.linkOnce")}</p>
        </div>
      ) : null}
    </div>
  );
}

export function RemoveMemberButton({ userId, label }: { userId: string; label: string }) {
  const t = useT();
  const localizeMessage = useLocalizeMessage();
  const [state, formAction] = useActionState(removeTeamMember, initialState);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm(t("team.removeConfirm", { label }))) event.preventDefault();
      }}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="userId" value={userId} />
      <SubmitButton
        idle={t("team.remove")}
        busy={t("team.removing")}
        className="rounded-xl border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50"
      />
      {state.error ? <p className="text-xs text-red-700">{localizeMessage(state.error)}</p> : null}
    </form>
  );
}

export function ChangeRoleButton({ userId, role, label }: { userId: string; role: "OWNER" | "MEMBER"; label: string }) {
  const t = useT();
  const localizeMessage = useLocalizeMessage();
  const [state, formAction] = useActionState(setTeamMemberRole, initialState);
  const promote = role === "OWNER";

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        const message = t(promote ? "team.makeOwnerConfirm" : "team.makeMemberConfirm", { label });
        if (!window.confirm(message)) event.preventDefault();
      }}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="role" value={role} />
      <SubmitButton
        idle={promote ? t("team.makeOwner") : t("team.makeMember")}
        busy={t("team.saving")}
        className="rounded-xl border border-line px-3 py-1.5 text-sm font-semibold text-ink hover:bg-mist"
      />
      {state.error ? <p className="text-xs text-red-700">{localizeMessage(state.error)}</p> : null}
    </form>
  );
}

export function RevokeInviteButton({ inviteId }: { inviteId: string }) {
  const t = useT();
  const localizeMessage = useLocalizeMessage();
  const [state, formAction] = useActionState(revokeTeamInvite, initialState);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="inviteId" value={inviteId} />
      <SubmitButton
        idle={t("team.revoke")}
        busy={t("team.revoking")}
        className="rounded-xl border border-line px-3 py-1.5 text-sm font-semibold text-ink hover:bg-mist"
      />
      {state.error ? <p className="text-xs text-red-700">{localizeMessage(state.error)}</p> : null}
    </form>
  );
}
