import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SignInButton } from "@/components/auth-buttons";
import { Pricing } from "@/components/landing/pricing";
import { auth } from "@/lib/auth";
import { startFreeTrial } from "@/lib/signup-actions";
import { firstSiteIdInWorkspace } from "@/lib/workspace-guards";

const inter = Inter({ subsets: ["latin"], variable: "--font-landing-body" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-landing-display" });

export const metadata: Metadata = {
  title: "DIYSEO: get found on Google and in AI answers",
  description:
    "DIYSEO finds the searches you're missing and publishes the content your website lacks, in your brand voice and on your own domain."
};

const weekExample = [
  { source: "Google", text: "You rank on page two for “kitchen renovation cost”" },
  { source: "AI answers", text: "ChatGPT cites your competitor instead of you on 3 questions" },
  { source: "Content", text: "Article drafted in your tone, ready to review" },
  { source: "Ads (coming soon)", text: "Campaign drafted and paused until you approve it" }
];

const cycle = [
  { title: "1. Measure", body: "Search Console, Bing, site speed and crawl data, plus what AI assistants say about your brand." },
  { title: "2. Decide", body: "Opportunities, pages losing traffic, and competitors showing up where you don't." },
  { title: "3. Publish", body: "Articles in your tone on your own domain, through WordPress or a widget." },
  { title: "4. Accelerate (coming soon)", body: "What works will move to Meta and Google Ads, landing page included, with no spend until you approve." }
];

const modules = [
  {
    status: "Available",
    live: true,
    title: "AI blog",
    body: "Articles in your brand voice, automatic publishing, translations, WordPress and publishing on your domain."
  },
  {
    status: "Coming soon",
    live: false,
    title: "SEO data",
    body: "Search Console, Bing, PageSpeed and site crawls, with opportunities and content decay."
  },
  {
    status: "Coming soon",
    live: false,
    title: "AI visibility",
    body: "What ChatGPT and Gemini tell your customers, and who they cite."
  },
  {
    status: "Coming soon",
    live: false,
    title: "Ads",
    body: "Meta and Google campaigns with copy, images and a landing page. Always paused until you approve."
  }
];

const heading = "font-display text-4xl font-bold leading-tight tracking-tight";
const wrap = "mx-auto max-w-[1180px] px-6";

type HomePageProps = {
  searchParams?: Promise<{ error?: string }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const session = await auth();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  if (session?.user?.id) {
    const firstSiteId = await firstSiteIdInWorkspace(session.user.workspaceId);

    redirect(firstSiteId ? `/${firstSiteId}` : "/settings");
  }

  return (
    <main className={`${inter.variable} ${spaceGrotesk.variable} overflow-x-clip bg-[#fbfaf6] font-body leading-relaxed text-ink`}>
      <header className={`${wrap} flex items-center justify-between gap-4 py-5`}>
        <Link href="/" className="font-display text-xl font-bold">
          DIYSEO
        </Link>
        <nav aria-label="Main" className="flex items-center gap-6 text-[15px] text-slate-700">
          <a href="#loop" className="hidden hover:text-ink md:inline">
            The loop
          </a>
          <a href="#modules" className="hidden hover:text-ink md:inline">
            Product
          </a>
          <a href="#pricing" className="hidden hover:text-ink md:inline">
            Pricing
          </a>
          {session?.user ? (
            <Link href="/settings" className="hover:text-ink">
              Open workspace
            </Link>
          ) : (
            <SignInButton label="Sign in" className="hover:text-ink" />
          )}
          <form action={startFreeTrial}>
            <button type="submit" className="rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800">
              Start free trial
            </button>
          </form>
        </nav>
      </header>

      {resolvedSearchParams?.error === "access_limited" ? (
        <div className={wrap}>
          <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            This account can't sign in. Contact info@diyseo.online if you think it should.
          </p>
        </div>
      ) : null}

      <section className={`${wrap} grid items-center gap-9 pb-[88px] pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14`}>
        <div>
          <p className="mb-4 text-[15px] font-semibold text-accent">For small businesses and agencies</p>
          <h1 className="font-display text-[40px] font-bold leading-[1.05] tracking-tight md:text-[60px]">
            Get found on Google and in AI answers.
          </h1>
          <p className="mt-5 max-w-[560px] text-[19px] text-slate-600">
            DIYSEO finds the searches you're missing and publishes the content your website lacks, in your brand voice
            and on your own domain. Ad campaigns are coming soon.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <form action={startFreeTrial}>
              <button type="submit" className="rounded-lg bg-accent px-5 py-3.5 font-semibold text-white transition hover:bg-teal-800">
                Start your free trial
              </button>
            </form>
            <a href="#pricing" className="rounded-lg border border-slate-400 px-5 py-3.5 font-semibold transition hover:bg-white">
              See pricing
            </a>
          </div>
        </div>

        <div className="rounded-[14px] border border-line bg-white p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-lg font-semibold">This week on your website</h2>
            <span className="text-xs text-slate-600">Example</span>
          </div>
          <div className="mt-3 divide-y divide-[#e8edf1]">
            {weekExample.map((item) => (
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
          <h2 className={`${heading} max-w-[720px]`}>Each step feeds the next.</h2>
          <p className="mt-4 max-w-[640px] text-lg text-slate-300">
            Buying these tools separately easily tops £300 a month, and you'd still have to connect them by hand.
          </p>
          <ol className="mt-11 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cycle.map((step) => (
              <li key={step.title} className="border-t-2 border-teal-300 pt-4">
                <p className="font-display text-[22px] font-semibold">{step.title}</p>
                <p className="mt-2 text-slate-300">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="modules" className={`${wrap} scroll-mt-4 py-20`}>
        <h2 className={heading}>What's included</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {modules.map((module) => (
            <article key={module.title} className="flex flex-col gap-2.5 rounded-[14px] border border-line bg-white p-5">
              <span
                className={`self-start rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  module.live ? "bg-teal-100 text-teal-800" : "bg-amber-100 text-amber-900"
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
          Connect your data to Claude, ChatGPT or Codex and ask about your website with real numbers.
        </p>
      </section>

      <section id="pricing" className="scroll-mt-4 bg-[#f1efe8] py-20">
        <div className={wrap}>
          <Pricing />
        </div>
      </section>

      <section id="start" className={`${wrap} scroll-mt-4 py-20`}>
        <div className="max-w-[620px]">
          <h2 className={heading}>Try it free for 7 days</h2>
          <p className="mt-3 text-lg text-slate-600">
            Sign in with Google and start with the Pro limits. No card needed. Pick a plan when you are ready.
          </p>
          <form action={startFreeTrial} className="mt-6">
            <button type="submit" className="rounded-lg bg-accent px-5 py-3.5 font-semibold text-white transition hover:bg-teal-800">
              Start your free trial
            </button>
          </form>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className={`${wrap} flex flex-wrap justify-between gap-4 py-6 text-sm text-slate-600`}>
          <span>DIYSEO</span>
          <nav aria-label="Footer" className="flex flex-wrap gap-5">
            <Link href="/blog" className="hover:text-ink">
              Blog
            </Link>
            <Link href="/privacy" className="hover:text-ink">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-ink">
              Terms
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
