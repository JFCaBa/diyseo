import { Inter, Space_Grotesk } from "next/font/google";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Pricing, type PricingPlan } from "@/components/landing/pricing";
import { auth } from "@/lib/auth";
import type { UiLocale } from "@/lib/i18n/locale";
import { createT, formatPlanPrice, type MessageKey } from "@/lib/i18n/translate";
import { LANDING_COPY, LANDING_CURRENCY, LANDING_PATH } from "@/lib/landing/copy";
import { PLANS } from "@/lib/plans";
import { startFreeTrial, startFreeTrialEs } from "@/lib/signup-actions";
import { firstSiteIdInWorkspace } from "@/lib/workspace-guards";

const inter = Inter({ subsets: ["latin"], variable: "--font-landing-body" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-landing-display" });

const heading = "font-display text-4xl font-bold leading-tight tracking-tight";
const wrap = "mx-auto max-w-[1180px] px-6";

/** Plan cards in this landing's language and currency; texts come from the app's billing catalog so both stay in step. */
function landingPlans(locale: UiLocale): PricingPlan[] {
  const t = createT(locale);
  const currency = LANDING_CURRENCY[locale];
  const price = (value: number) => formatPlanPrice(value, currency, locale);

  return PLANS.map((plan) => ({
    id: plan.id,
    name: plan.name,
    featured: plan.featured,
    tagline: t(`billing.plans.${plan.id}.tagline` as MessageKey),
    monthly: price(plan.monthlyPrice),
    annual: price(plan.annualMonthlyPrice),
    features: plan.features.map((_, index) => t(`billing.plans.${plan.id}.f${index + 1}` as MessageKey, { price: price(15) }))
  }));
}

type LandingPageProps = {
  locale: UiLocale;
  searchParams?: Promise<{ error?: string }>;
};

/** The marketing landing: `/` (English, pounds) and `/es` (Spanish, euros). */
export async function LandingPage({ locale, searchParams }: LandingPageProps) {
  const session = await auth();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  if (session?.user?.id) {
    const firstSiteId = await firstSiteIdInWorkspace(session.user.workspaceId);

    redirect(firstSiteId ? `/${firstSiteId}` : "/settings");
  }

  const copy = LANDING_COPY[locale];
  const other: UiLocale = locale === "es" ? "en" : "es";
  const signUp = locale === "es" ? startFreeTrialEs : startFreeTrial;
  const plans = landingPlans(locale);

  return (
    <main lang={locale} className={`${inter.variable} ${spaceGrotesk.variable} overflow-x-clip bg-[#fbfaf6] font-body leading-relaxed text-ink`}>
      <header className={`${wrap} flex items-center justify-between gap-4 py-5`}>
        <Link href={LANDING_PATH[locale]} className="font-display text-xl font-bold">
          DIYSEO
        </Link>
        <nav aria-label={copy.nav.main} className="flex items-center gap-6 text-[15px] text-slate-700">
          <a href="#loop" className="hidden hover:text-ink md:inline">
            {copy.nav.loop}
          </a>
          <a href="#modules" className="hidden hover:text-ink md:inline">
            {copy.nav.product}
          </a>
          <a href="#pricing" className="hidden hover:text-ink md:inline">
            {copy.nav.pricing}
          </a>
          <Link href={LANDING_PATH[other]} hrefLang={other} lang={other} className="hover:text-ink">
            {copy.nav.otherLanguage}
          </Link>
          {session?.user ? (
            <Link href="/settings" className="hover:text-ink">
              {copy.nav.openWorkspace}
            </Link>
          ) : (
            <form action={signUp}>
              <button type="submit" className="hover:text-ink">
                {copy.nav.signIn}
              </button>
            </form>
          )}
          <form action={signUp}>
            <button type="submit" className="rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800">
              {copy.nav.startTrial}
            </button>
          </form>
        </nav>
      </header>

      {resolvedSearchParams?.error === "access_limited" ? (
        <div className={wrap}>
          <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {copy.accessLimited}
          </p>
        </div>
      ) : null}

      <section className={`${wrap} grid items-center gap-9 pb-[88px] pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14`}>
        <div>
          <p className="mb-4 text-[15px] font-semibold text-accent">{copy.hero.eyebrow}</p>
          <h1 className="font-display text-[40px] font-bold leading-[1.05] tracking-tight md:text-[60px]">
            {copy.hero.title}
          </h1>
          <p className="mt-5 max-w-[560px] text-[19px] text-slate-600">
            {copy.hero.body}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <form action={signUp}>
              <button type="submit" className="rounded-lg bg-accent px-5 py-3.5 font-semibold text-white transition hover:bg-teal-800">
                {copy.hero.cta}
              </button>
            </form>
            <a href="#pricing" className="rounded-lg border border-slate-400 px-5 py-3.5 font-semibold transition hover:bg-white">
              {copy.hero.seePricing}
            </a>
          </div>
        </div>

        <div className="rounded-[14px] border border-line bg-white p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-lg font-semibold">{copy.week.title}</h2>
            <span className="text-xs text-slate-600">{copy.week.example}</span>
          </div>
          <div className="mt-3 divide-y divide-[#e8edf1]">
            {copy.week.items.map((item) => (
              <div key={item.source} className="py-3">
                <p className="text-xs font-semibold text-accent">{item.source}</p>
                <p className="mt-0.5 text-[15px]">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="loop" className="scroll-mt-4 bg-ink py-20 text-slate-50">
        <div className={wrap}>
          <h2 className={`${heading} max-w-[720px]`}>{copy.loop.title}</h2>
          <p className="mt-4 max-w-[640px] text-lg text-slate-300">
            {copy.loop.body}
          </p>
          <ol className="mt-11 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {copy.loop.steps.map((step) => (
              <li key={step.title} className="border-t-2 border-teal-300 pt-4">
                <p className="font-display text-[22px] font-semibold">{step.title}</p>
                <p className="mt-2 text-slate-300">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="modules" className={`${wrap} scroll-mt-4 py-20`}>
        <h2 className={heading}>{copy.modules.title}</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {copy.modules.items.map((module) => (
            <article key={module.title} className="flex flex-col gap-2.5 rounded-[14px] border border-line bg-white p-5">
              <span
                className={`self-start rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  "bg-teal-100 text-teal-800"
                }`}
              >
                {module.status}
              </span>
              <h3 className="font-display text-xl font-semibold">{module.title}</h3>
              <p className="text-[15px] text-slate-600">{module.body}</p>
            </article>
          ))}
        </div>
        <p className="mt-5 text-[15px] text-slate-600">
          {copy.modules.footnote}
        </p>
      </section>

      <section id="pricing" className="scroll-mt-4 bg-[#f1efe8] py-20">
        <div className={wrap}>
          <Pricing copy={copy.pricing} plans={plans} signUp={signUp} />
        </div>
      </section>

      <section id="start" className={`${wrap} scroll-mt-4 py-20`}>
        <div className="max-w-[620px]">
          <h2 className={heading}>{copy.start.title}</h2>
          <p className="mt-3 text-lg text-slate-600">
            {copy.start.body}
          </p>
          <form action={signUp} className="mt-6">
            <button type="submit" className="rounded-lg bg-accent px-5 py-3.5 font-semibold text-white transition hover:bg-teal-800">
              {copy.start.cta}
            </button>
          </form>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className={`${wrap} flex flex-wrap justify-between gap-4 py-6 text-sm text-slate-600`}>
          <span>DIYSEO</span>
          <nav aria-label={copy.footer.label} className="flex flex-wrap gap-5">
            <Link href="/blog" className="hover:text-ink">
              {copy.footer.blog}
            </Link>
            <Link href="/privacy" className="hover:text-ink">
              {copy.footer.privacy}
            </Link>
            <Link href="/terms" className="hover:text-ink">
              {copy.footer.terms}
            </Link>
            <a href="https://github.com/JFCaBa/diyseo" target="_blank" rel="noreferrer" className="hover:text-ink">
              GitHub
            </a>
          </nav>
        </div>
      </footer>
    </main>
  );
}
