import { redirect } from "next/navigation";

import { BillingPlanPicker } from "@/components/billing-plan-picker";
import { hasDuplicateSubscriptions } from "@/lib/billing";
import { checkoutCurrency, stripeCustomerCurrency } from "@/lib/billing-currency-server";
import { openBillingPortal } from "@/lib/billing-actions";
import { getT, getUiLocale } from "@/lib/i18n/server";
import { formatDateMedium, type T } from "@/lib/i18n/translate";
import { prisma } from "@/lib/prisma";
import { getUsageSummary } from "@/lib/quota";
import type { SatelliteService } from "@/lib/satellite-entitlements";
import { requireWorkspace } from "@/lib/workspace-context";

const PLAN_LABEL_KEYS = {
  TRIAL: "billing.planTrial",
  COMP: "billing.planComp",
  NONE: "billing.planNone"
} as const;

const MESSAGES = {
  "checkout=success": { tone: "ok", key: "billing.checkoutSuccess" },
  "error=invalid_plan": { tone: "error", key: "billing.errInvalidPlan" },
  "error=price_missing": { tone: "error", key: "billing.errPriceMissing" },
  "error=checkout_missing": { tone: "error", key: "billing.errCheckoutMissing" },
  "error=checkout_mismatch": { tone: "error", key: "billing.errCheckoutMismatch" },
  "error=checkout_incomplete": { tone: "error", key: "billing.errCheckoutIncomplete" },
  "error=owner_only": { tone: "error", key: "billing.ownerOnly" }
} as const;

// Shown when a service sends someone here because their plan does not include it.
const UPGRADE_NOTICE_KEYS = {
  ads: "billing.upgradeAds",
  mcp: "billing.upgradeMcp"
} as const satisfies Record<SatelliteService, string>;

function planLabel(plan: string, t: T) {
  // Starter, Pro and Agency are product names and stay as they are.
  return plan in PLAN_LABEL_KEYS ? t(PLAN_LABEL_KEYS[plan as keyof typeof PLAN_LABEL_KEYS]) : plan.charAt(0) + plan.slice(1).toLowerCase();
}

export type BillingSearchParams = { checkout?: string; error?: string; upgrade?: string };

function UpgradeNotice({ text }: { text: string }) {
  return (
    <p role="status" className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      {text}
    </p>
  );
}

function Meter({ label, used, limit, noLimit }: { label: string; used: number; limit: number | null; noLimit: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white px-4 py-3">
      <p className="text-sm text-slate-600">{label}</p>
      <p className="mt-1 text-xl font-semibold text-ink">
        {used}
        <span className="text-sm font-normal text-slate-600"> / {limit === null ? noLimit : limit}</span>
      </p>
    </div>
  );
}

/** The billing page body, rendered inside the site layout (or standalone when the workspace has no site). */
export async function BillingPageContent({ searchParams }: { searchParams?: BillingSearchParams }) {
  const t = await getT();
  const locale = await getUiLocale();
  const member = await requireWorkspace().catch(() => null);

  if (!member) {
    redirect("/");
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: member.workspaceId },
    select: { id: true, name: true }
  });

  if (!workspace) {
    redirect("/");
  }

  const upgrade = searchParams?.upgrade;
  const upgradeNotice = upgrade === "ads" || upgrade === "mcp" ? t(UPGRADE_NOTICE_KEYS[upgrade]) : undefined;
  const header = (
    <div>
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">{t("nav.billing")}</p>
      <h1 className="mt-2 text-3xl font-semibold text-ink">{workspace.name}</h1>
    </div>
  );

  if (member.role !== "OWNER") {
    const owner = upgradeNotice
      ? await prisma.workspaceMember.findFirst({
          where: { workspaceId: workspace.id, role: "OWNER" },
          select: { user: { select: { email: true } } }
        })
      : null;
    const ownerEmail = owner?.user.email;

    return (
      <div className="mx-auto max-w-5xl">
        {header}
        {upgradeNotice ? (
          <UpgradeNotice
            text={`${upgradeNotice} ${ownerEmail ? t("billing.askOwnerWithEmail", { email: ownerEmail }) : t("billing.askOwner")}`}
          />
        ) : (
          <p className="mt-8 text-sm text-slate-600">{t("billing.ownerOnly")}</p>
        )}
      </div>
    );
  }

  const usage = await getUsageSummary(workspace.id);
  const duplicate = usage.stripeCustomerId ? await hasDuplicateSubscriptions(usage.stripeCustomerId).catch(() => false) : false;
  const messageKey = searchParams?.checkout ? `checkout=${searchParams.checkout}` : searchParams?.error ? `error=${searchParams.error}` : null;
  const message = messageKey && messageKey in MESSAGES ? MESSAGES[messageKey as keyof typeof MESSAGES] : undefined;
  const paid = usage.plan === "STARTER" || usage.plan === "PRO" || usage.plan === "AGENCY";
  const currency =
    paid || usage.plan === "COMP"
      ? "gbp"
      : checkoutCurrency({ customerCurrency: usage.stripeCustomerId ? await stripeCustomerCurrency(usage.stripeCustomerId).catch(() => null) : null, locale });

  return (
    <div className="mx-auto max-w-5xl">
      {header}

      {message ? (
        <p
          role="status"
          className={`mt-6 rounded-xl border px-4 py-3 text-sm ${message.tone === "ok" ? "border-teal-200 bg-teal-50 text-teal-900" : "border-red-200 bg-red-50 text-red-900"}`}
        >
          {t(message.key)}
        </p>
      ) : null}

      {upgradeNotice ? <UpgradeNotice text={upgradeNotice} /> : null}

      {usage.subscriptionStatus === "past_due" ? (
        <p role="alert" className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {t("billing.pastDue")}
        </p>
      ) : null}

      {duplicate ? (
        <p role="alert" className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {t("billing.duplicate")}
        </p>
      ) : null}

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-white px-4 py-3">
          <p className="text-sm text-slate-600">{t("billing.plan")}</p>
          <p className="mt-1 text-xl font-semibold text-ink">{planLabel(usage.plan, t)}</p>
          {usage.plan === "TRIAL" && usage.trialEndsAt ? (
            <p className="mt-1 text-xs text-slate-600">{t("billing.ends", { date: formatDateMedium(usage.trialEndsAt, locale) })}</p>
          ) : null}
        </div>
        <Meter label={t("billing.sites")} used={usage.sites} limit={usage.limits ? usage.limits.sites : null} noLimit={t("billing.noLimit")} />
        <Meter
          label={t("billing.aiArticlesMonth")}
          used={usage.articles}
          limit={usage.limits ? usage.limits.articlesPerMonth : null}
          noLimit={t("billing.noLimit")}
        />
      </section>

      {usage.plan === "COMP" ? (
        <p className="mt-8 text-sm text-slate-600">{t("billing.complimentary")}</p>
      ) : paid ? (
        <form action={openBillingPortal} className="mt-8">
          <p className="text-sm text-slate-600">{t("billing.portalHelp")}</p>
          <button type="submit" className="mt-3 min-h-11 rounded-xl bg-ink px-5 text-sm font-semibold text-white hover:bg-slate-800">
            {t("billing.manage")}
          </button>
        </form>
      ) : (
        <section className="mt-10">
          <h2 className="text-xl font-semibold text-ink">{t("billing.choosePlan")}</h2>
          <div className="mt-4">
            <BillingPlanPicker currency={currency} />
          </div>
          {usage.stripeCustomerId ? (
            <form action={openBillingPortal} className="mt-4">
              <button type="submit" className="text-sm font-semibold text-accent hover:underline">
                {t("billing.pastInvoices")}
              </button>
            </form>
          ) : null}
        </section>
      )}
    </div>
  );
}
