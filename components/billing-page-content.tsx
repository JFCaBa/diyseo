import { redirect } from "next/navigation";

import { BillingPlanPicker } from "@/components/billing-plan-picker";
import { hasDuplicateSubscriptions } from "@/lib/billing";
import { openBillingPortal } from "@/lib/billing-actions";
import { prisma } from "@/lib/prisma";
import { getUsageSummary } from "@/lib/quota";
import type { SatelliteService } from "@/lib/satellite-entitlements";
import { requireWorkspace } from "@/lib/workspace-context";

const PLAN_LABELS: Record<string, string> = {
  TRIAL: "Free trial",
  STARTER: "Starter",
  PRO: "Pro",
  AGENCY: "Agency",
  COMP: "Complimentary",
  NONE: "No active plan"
};

const MESSAGES: Record<string, { tone: "ok" | "error"; text: string }> = {
  "checkout=success": { tone: "ok", text: "Thanks! Your plan is active." },
  "error=invalid_plan": { tone: "error", text: "That plan is not available." },
  "error=price_missing": { tone: "error", text: "That price is not set up yet. Please contact support." },
  "error=checkout_missing": { tone: "error", text: "We could not find that checkout." },
  "error=checkout_mismatch": { tone: "error", text: "That checkout belongs to a different account." },
  "error=checkout_incomplete": { tone: "error", text: "That checkout was not completed, so nothing was charged." },
  "error=owner_only": { tone: "error", text: "Only the workspace owner can manage billing." }
};

// Shown when a service sends someone here because their plan does not include it.
const UPGRADE_NOTICES: Record<SatelliteService, string> = {
  ads: "Ads campaigns are included in Pro and Agency.",
  mcp: "Your plan doesn't include SEO data in Claude."
};

export type BillingSearchParams = { checkout?: string; error?: string; upgrade?: string };

function UpgradeNotice({ text }: { text: string }) {
  return (
    <p role="status" className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      {text}
    </p>
  );
}

function Meter({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  return (
    <div className="rounded-2xl border border-line bg-white px-4 py-3">
      <p className="text-sm text-slate-600">{label}</p>
      <p className="mt-1 text-xl font-semibold text-ink">
        {used}
        <span className="text-sm font-normal text-slate-600"> / {limit === null ? "no limit" : limit}</span>
      </p>
    </div>
  );
}

/** The billing page body, rendered inside the site layout (or standalone when the workspace has no site). */
export async function BillingPageContent({ searchParams }: { searchParams?: BillingSearchParams }) {
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
  const upgradeNotice = upgrade === "ads" || upgrade === "mcp" ? UPGRADE_NOTICES[upgrade] : undefined;
  const header = (
    <div>
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">Billing</p>
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
            text={`${upgradeNotice} ${ownerEmail ? `Ask your workspace owner (${ownerEmail}) to upgrade.` : "Ask your workspace owner to upgrade."}`}
          />
        ) : (
          <p className="mt-8 text-sm text-slate-600">Only the workspace owner can manage billing.</p>
        )}
      </div>
    );
  }

  const usage = await getUsageSummary(workspace.id);
  const duplicate = usage.stripeCustomerId ? await hasDuplicateSubscriptions(usage.stripeCustomerId).catch(() => false) : false;
  const messageKey = searchParams?.checkout ? `checkout=${searchParams.checkout}` : searchParams?.error ? `error=${searchParams.error}` : null;
  const message = messageKey ? MESSAGES[messageKey] : undefined;
  const paid = usage.plan === "STARTER" || usage.plan === "PRO" || usage.plan === "AGENCY";

  return (
    <div className="mx-auto max-w-5xl">
      {header}

      {message ? (
        <p
          role="status"
          className={`mt-6 rounded-xl border px-4 py-3 text-sm ${message.tone === "ok" ? "border-teal-200 bg-teal-50 text-teal-900" : "border-red-200 bg-red-50 text-red-900"}`}
        >
          {message.text}
        </p>
      ) : null}

      {upgradeNotice ? <UpgradeNotice text={upgradeNotice} /> : null}

      {usage.subscriptionStatus === "past_due" ? (
        <p role="alert" className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Your last payment failed. Update your card in Manage billing to keep your plan.
        </p>
      ) : null}

      {duplicate ? (
        <p role="alert" className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          You have more than one active subscription. Contact info@diyseo.online and we will refund the extra one.
        </p>
      ) : null}

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-white px-4 py-3">
          <p className="text-sm text-slate-600">Plan</p>
          <p className="mt-1 text-xl font-semibold text-ink">{PLAN_LABELS[usage.plan]}</p>
          {usage.plan === "TRIAL" && usage.trialEndsAt ? (
            <p className="mt-1 text-xs text-slate-600">Ends {usage.trialEndsAt.toLocaleDateString("en-GB", { dateStyle: "medium" })}</p>
          ) : null}
        </div>
        <Meter label="Sites" used={usage.sites} limit={usage.limits ? usage.limits.sites : null} />
        <Meter label="AI articles this month" used={usage.articles} limit={usage.limits ? usage.limits.articlesPerMonth : null} />
      </section>

      {usage.plan === "COMP" ? (
        <p className="mt-8 text-sm text-slate-600">This workspace is on a complimentary plan with no limits.</p>
      ) : paid ? (
        <form action={openBillingPortal} className="mt-8">
          <p className="text-sm text-slate-600">Change plan, update your card, download invoices or cancel in the Stripe portal.</p>
          <button type="submit" className="mt-3 min-h-11 rounded-xl bg-ink px-5 text-sm font-semibold text-white hover:bg-slate-800">
            Manage billing
          </button>
        </form>
      ) : (
        <section className="mt-10">
          <h2 className="text-xl font-semibold text-ink">Choose a plan</h2>
          <div className="mt-4">
            <BillingPlanPicker />
          </div>
          {usage.stripeCustomerId ? (
            <form action={openBillingPortal} className="mt-4">
              <button type="submit" className="text-sm font-semibold text-accent hover:underline">
                View past invoices
              </button>
            </form>
          ) : null}
        </section>
      )}
    </div>
  );
}
