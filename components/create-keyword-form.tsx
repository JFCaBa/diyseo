"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { useLocalizeMessage, useT } from "@/components/i18n-provider";
import { createKeyword, type ActionState } from "@/lib/actions";

type CreateKeywordFormProps = {
  siteId: string;
};

const initialState: ActionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useT();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? t("keywords.adding") : t("keywords.add")}
    </button>
  );
}

export function CreateKeywordForm({ siteId }: CreateKeywordFormProps) {
  const t = useT();
  const localizeMessage = useLocalizeMessage();
  const createKeywordForSite = createKeyword.bind(null, siteId);
  const [state, formAction] = useActionState(createKeywordForSite, initialState);

  return (
    <form action={formAction} className="grid gap-4 rounded-3xl border border-line bg-white/85 p-6 shadow-panel">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-ink">{t("keywords.addTitle")}</h2>
        <p className="text-sm text-slate-600">
          {t("keywords.addDescription")}
        </p>
      </div>

      <div className="grid gap-2">
        <label htmlFor="term" className="text-sm font-medium text-ink">
          {t("keywords.termLabel")}
        </label>
        <input
          id="term"
          name="term"
          placeholder={t("keywords.termPlaceholder")}
          className="rounded-2xl border border-line px-4 py-3 outline-none transition focus:border-accent"
          required
        />
      </div>

      {state.error ? <p className="text-sm text-red-600">{localizeMessage(state.error)}</p> : null}
      {state.success ? <p className="text-sm text-accent">{localizeMessage(state.success)}</p> : null}

      <SubmitButton />
    </form>
  );
}
