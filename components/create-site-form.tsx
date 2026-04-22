"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { createSite, type ActionState } from "@/lib/actions";

const initialState: ActionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Creating..." : "Create Website"}
    </button>
  );
}

type CreateSiteFormProps = {
  backHref?: string;
};

export function CreateSiteForm({ backHref }: CreateSiteFormProps) {
  const [state, formAction] = useActionState(createSite, initialState);

  return (
    <form action={formAction} className="grid gap-4 rounded-3xl border border-line bg-white/90 p-6 shadow-panel">
      <div className="grid gap-2">
        <label htmlFor="name" className="text-sm font-medium text-ink">
          Site name
        </label>
        <input
          id="name"
          name="name"
          placeholder="Acme Blog"
          className="rounded-2xl border border-line px-4 py-3 outline-none transition focus:border-accent"
          required
        />
      </div>

      <div className="grid gap-2">
        <label htmlFor="domain" className="text-sm font-medium text-ink">
          Domain
        </label>
        <input
          id="domain"
          name="domain"
          placeholder="https://example.com"
          className="rounded-2xl border border-line px-4 py-3 outline-none transition focus:border-accent"
          required
        />
        <p className="text-xs text-slate-500">Use the canonical site URL, including protocol.</p>
      </div>

      <div className="grid gap-2">
        <label htmlFor="contentLanguage" className="text-sm font-medium text-ink">
          Content language
        </label>
        <input
          id="contentLanguage"
          name="contentLanguage"
          defaultValue="en"
          placeholder="en"
          className="rounded-2xl border border-line px-4 py-3 outline-none transition focus:border-accent"
          required
        />
        <p className="text-xs text-slate-500">Short code is fine here, for example `en`, `en-US`, or `es`.</p>
      </div>

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-accent">{state.success}</p> : null}

      <div className="flex items-center justify-between gap-3">
        {backHref ? (
          <Link
            href={backHref}
            className="inline-flex items-center justify-center rounded-2xl border border-line px-4 py-3 text-sm font-semibold text-ink transition hover:bg-mist"
          >
            Back
          </Link>
        ) : (
          <span />
        )}
        <SubmitButton />
      </div>
    </form>
  );
}
