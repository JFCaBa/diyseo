"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { useLocalizeMessage, useT } from "@/components/i18n-provider";
import { deleteSite, type ActionState } from "@/lib/actions";

const initialState: ActionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useT();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-2xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? t("settings.delete.deleting") : t("settings.delete.deleteSite")}
    </button>
  );
}

type SiteDeleteFormProps = {
  siteId: string;
  siteName: string;
};

export function SiteDeleteForm({ siteId, siteName }: SiteDeleteFormProps) {
  const t = useT();
  const localizeMessage = useLocalizeMessage();
  const deleteSiteForCurrentSite = deleteSite.bind(null, siteId);
  const [state, formAction] = useActionState(deleteSiteForCurrentSite, initialState);
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center justify-center rounded-2xl border border-red-200 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50"
      >
        {t("settings.delete.open")}
      </button>
    );
  }

  return (
    <form action={formAction} className="grid gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
      <div>
        <p className="text-sm font-semibold text-red-900">{t("settings.delete.deleteSite")}</p>
        <p className="mt-1 text-xs text-red-800">
          {t("settings.delete.warning")}
        </p>
      </div>

      <div className="grid gap-2">
        <label htmlFor={`delete-site-${siteId}`} className="text-sm font-medium text-red-900">
          {t("settings.delete.confirmLabel")}
        </label>
        <input
          id={`delete-site-${siteId}`}
          name="confirmName"
          placeholder={siteName}
          className="rounded-2xl border border-red-200 bg-white px-4 py-3 outline-none transition focus:border-red-400"
          required
        />
      </div>

      {state.error ? <p className="text-sm text-red-700">{localizeMessage(state.error)}</p> : null}

      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="inline-flex items-center justify-center rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink transition hover:bg-mist"
        >
          {t("settings.delete.cancel")}
        </button>
        <SubmitButton />
      </div>
    </form>
  );
}
