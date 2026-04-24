"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { signInToAdmin, type AdminAuthState } from "@/app/admin/actions";

const initialState: AdminAuthState = {};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? "Unlocking..." : "Enter admin"}
    </button>
  );
}

type AdminPasswordFormProps = {
  isConfigured: boolean;
};

export function AdminPasswordForm({ isConfigured }: AdminPasswordFormProps) {
  const [state, formAction] = useActionState(signInToAdmin, initialState);

  return (
    <form action={formAction} className="grid gap-4 rounded-[2rem] border border-slate-800 bg-slate-900/90 p-8 shadow-2xl">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-teal-400">Internal Admin</p>
        <h1 className="text-3xl font-semibold tracking-tight text-white">Platform access</h1>
        <p className="text-sm text-slate-400">
          Hidden internal area. Enter the shared admin password to continue.
        </p>
      </div>

      <div className="grid gap-2">
        <label htmlFor="password" className="text-sm font-medium text-slate-200">
          Admin password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-teal-400"
          disabled={!isConfigured}
          required
        />
      </div>

      {!isConfigured ? <p className="text-sm text-amber-300">ADMIN_PASSWORD is not configured.</p> : null}
      {state.error ? <p className="text-sm text-rose-300">{state.error}</p> : null}

      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}
