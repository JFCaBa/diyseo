"use client";

import { useState } from "react";
import clsx from "clsx";

import type { LandingCopy } from "@/lib/landing/copy";
import type { PlanId } from "@/lib/plans";

/** A plan card already in the landing's language and currency. */
export type PricingPlan = {
  id: PlanId;
  name: string;
  featured: boolean;
  tagline: string;
  monthly: string;
  annual: string;
  features: string[];
};

type PricingProps = {
  copy: LandingCopy["pricing"];
  plans: PricingPlan[];
  signUp: () => Promise<void>;
};

export function Pricing({ copy, plans, signUp }: PricingProps) {
  const [annual, setAnnual] = useState(false);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <h2 className="font-display text-4xl font-bold leading-tight tracking-tight">{copy.title}</h2>
          <p className="mt-2 text-slate-600">{copy.intro}</p>
        </div>
        <div role="group" aria-label={copy.periodLabel} className="flex gap-1 rounded-[10px] border border-slate-300 bg-white p-1">
          {[
            { label: copy.monthly, active: !annual, value: false },
            { label: copy.annual, active: annual, value: true }
          ].map((option) => (
            <button
              key={option.label}
              type="button"
              aria-pressed={option.active}
              onClick={() => setAnnual(option.value)}
              className={clsx(
                "min-h-11 rounded-md px-3.5 py-2.5 font-semibold transition",
                option.active ? "bg-ink text-white" : "text-slate-700 hover:bg-slate-100"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {plans.map((plan) => (
          <article
            key={plan.id}
            className={clsx(
              "flex flex-col rounded-[14px] bg-white p-6",
              plan.featured ? "border-2 border-accent" : "border border-slate-300"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-[22px] font-semibold">{plan.name}</h3>
              {plan.featured ? <span className="text-xs font-semibold text-accent">{copy.featured}</span> : null}
            </div>
            <p className="mt-1.5 text-[15px] text-slate-600">{plan.tagline}</p>
            <p className="mt-4">
              <span className="font-display text-[46px] font-bold">{annual ? plan.annual : plan.monthly}</span>
              <span className="text-slate-600">{copy.perMonth}</span>
            </p>
            <ul className="mb-5 mt-4 flex flex-grow list-disc flex-col gap-2 pl-[18px] text-[15px]">
              {plan.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
            <form action={signUp}>
              <button
                type="submit"
                className="block w-full rounded-lg bg-ink px-4 py-3 text-center font-semibold text-white transition hover:bg-slate-800"
              >
                {copy.cta}
              </button>
            </form>
          </article>
        ))}
      </div>
    </>
  );
}
