"use client";

import { useActionState } from "react";
import Link from "next/link";

import { joinWaitlist, type WaitlistState } from "@/lib/actions";
import { PLANS, type PlanId } from "@/lib/plans";

const initialState: WaitlistState = { status: "idle" };

export function WaitlistForm({ defaultPlan }: { defaultPlan: PlanId | null }) {
  const [state, formAction, pending] = useActionState(joinWaitlist, initialState);

  if (state.status === "success") {
    return (
      <p role="status" className="mt-6 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 font-medium text-teal-900">
        Ya estás en la lista. Te escribiremos cuando tengas plaza.
      </p>
    );
  }

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-3.5">
      <label className="flex flex-col gap-1.5 text-[15px] font-medium">
        Tu email
        <input
          type="email"
          name="email"
          required
          maxLength={254}
          autoComplete="email"
          placeholder="tu@empresa.com"
          className="rounded-lg border border-slate-400 bg-white px-3.5 py-3 font-normal"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-[15px] font-medium">
        Plan que te interesa
        <select name="plan" defaultValue={defaultPlan ?? ""} className="rounded-lg border border-slate-400 bg-white px-3.5 py-3 font-normal">
          <option value="">Aún no lo sé</option>
          {PLANS.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name}
            </option>
          ))}
        </select>
      </label>
      {/* Honeypot: hidden from people and from the tab order. */}
      <div aria-hidden="true" className="absolute -left-[9999px]">
        <label>
          Web
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-lg bg-accent px-5 py-3.5 font-semibold text-white transition hover:bg-teal-800 disabled:opacity-60"
      >
        {pending ? "Apuntando…" : "Apuntarme"}
      </button>
      <p aria-live="polite" className="text-sm font-medium text-red-700">
        {state.status === "error" ? state.message : null}
      </p>
      <p className="text-[13px] text-slate-600">
        Usaremos tu email solo para avisarte del acceso. Más información en la{" "}
        <Link href="/privacy" className="underline">
          política de privacidad
        </Link>
        .
      </p>
    </form>
  );
}
