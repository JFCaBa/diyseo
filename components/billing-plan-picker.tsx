"use client";

import { useState } from "react";
import clsx from "clsx";

import { startCheckout } from "@/lib/billing-actions";
import { PLANS } from "@/lib/plans";

export function BillingPlanPicker() {
  const [interval, setInterval] = useState<"monthly" | "annual">("monthly");

  return (
    <div>
      <div role="group" aria-label="Billing period" className="inline-flex gap-1 rounded-xl border border-line bg-white p-1">
        {(["monthly", "annual"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={interval === value}
            onClick={() => setInterval(value)}
            className={clsx(
              "min-h-11 rounded-lg px-4 text-sm font-semibold",
              interval === value ? "bg-ink text-white" : "text-slate-700 hover:bg-slate-100"
            )}
          >
            {value === "monthly" ? "Monthly" : "Annual, save 20%"}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {PLANS.map((plan) => (
          <form key={plan.id} action={startCheckout} className="flex flex-col rounded-2xl border border-line bg-white p-5">
            <input type="hidden" name="plan" value={plan.id} />
            <input type="hidden" name="interval" value={interval} />
            <h3 className="text-lg font-semibold text-ink">{plan.name}</h3>
            <p className="mt-1 text-sm text-slate-600">{plan.tagline}</p>
            <p className="mt-4 text-3xl font-semibold text-ink">
              £{interval === "annual" ? plan.annualMonthlyPrice : plan.monthlyPrice}
              <span className="text-sm font-normal text-slate-600"> /month{interval === "annual" ? ", billed yearly" : ""}</span>
            </p>
            <ul className="mb-5 mt-4 flex-grow list-disc space-y-1 pl-5 text-sm text-slate-700">
              {plan.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
            <button type="submit" className="min-h-11 rounded-xl bg-ink px-4 text-sm font-semibold text-white hover:bg-slate-800">
              Choose {plan.name}
            </button>
          </form>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-600">Prices in GBP, including any VAT due. Payment is handled by Stripe.</p>
    </div>
  );
}
