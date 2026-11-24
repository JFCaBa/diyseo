"use client";

import { useState } from "react";
import clsx from "clsx";

import { useLocale, useT } from "@/components/i18n-provider";
import { startCheckout } from "@/lib/billing-actions";
import { formatNumber, type MessageKey } from "@/lib/i18n/translate";
import { PLANS } from "@/lib/plans";

export function BillingPlanPicker() {
  const t = useT();
  const locale = useLocale();
  const [interval, setInterval] = useState<"monthly" | "annual">("monthly");

  return (
    <div>
      <div role="group" aria-label={t("billing.periodLabel")} className="inline-flex gap-1 rounded-xl border border-line bg-white p-1">
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
            {value === "monthly" ? t("billing.monthly") : t("billing.annual")}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {PLANS.map((plan) => {
          const price = interval === "annual" ? plan.annualMonthlyPrice : plan.monthlyPrice;

          return (
          <form key={plan.id} action={startCheckout} className="flex flex-col rounded-2xl border border-line bg-white p-5">
            <input type="hidden" name="plan" value={plan.id} />
            <input type="hidden" name="interval" value={interval} />
            <h3 className="text-lg font-semibold text-ink">{plan.name}</h3>
            <p className="mt-1 text-sm text-slate-600">{t(`billing.plans.${plan.id}.tagline` as MessageKey)}</p>
            <p className="mt-4 text-3xl font-semibold text-ink">
              {formatNumber(price, locale, { style: "currency", currency: "GBP", maximumFractionDigits: 0 })}
              <span className="text-sm font-normal text-slate-600"> {t(interval === "annual" ? "billing.perMonthYearly" : "billing.perMonth")}</span>
            </p>
            <ul className="mb-5 mt-4 flex-grow list-disc space-y-1 pl-5 text-sm text-slate-700">
              {plan.features.map((feature, index) => (
                <li key={feature}>{t(`billing.plans.${plan.id}.f${index + 1}` as MessageKey)}</li>
              ))}
            </ul>
            <button type="submit" className="min-h-11 rounded-xl bg-ink px-4 text-sm font-semibold text-white hover:bg-slate-800">
              {t("billing.choose", { plan: plan.name })}
            </button>
          </form>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-slate-600">{t("billing.vatNote")}</p>
    </div>
  );
}
