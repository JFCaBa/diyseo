import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SignInButton } from "@/components/auth-buttons";
import { Pricing } from "@/components/landing/pricing";
import { WaitlistForm } from "@/components/landing/waitlist-form";
import { auth } from "@/lib/auth";
import { isPlanId } from "@/lib/plans";
import { prisma } from "@/lib/prisma";

const inter = Inter({ subsets: ["latin"], variable: "--font-landing-body" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-landing-display" });

export const metadata: Metadata = {
  title: "DIYSEO: get found on Google, in AI answers and through ads",
  description:
    "DIYSEO finds the searches you're missing, publishes the content your website lacks and turns what works into ad campaigns."
};

const weekExample = [
  { source: "Google", text: "You rank on page two for “kitchen renovation cost”" },
  { source: "AI answers", text: "ChatGPT cites your competitor instead of you on 3 questions" },
  { source: "Content", text: "Article drafted in your tone, ready to review" },
  { source: "Ads", text: "Campaign drafted and paused until you approve it" }
];

const cycle = [
  { title: "1. Measure", body: "Search Console, Bing, site speed and crawl data, plus what AI assistants say about your brand." },
  { title: "2. Decide", body: "Opportunities, pages losing traffic, and competitors showing up where you don't." },
  { title: "3. Publish", body: "Articles in your tone on your own domain, through WordPress or a widget." },
  { title: "4. Accelerate", body: "What works moves to Meta and Google Ads, landing page included, with no spend until you approve." }
];

const modules = [
  {
    status: "Available",
    live: true,
    title: "AI blog",
    body: "Articles in your brand voice, automatic publishing, translations, WordPress and publishing on your domain."
  },
  {
    status: "Early access",
    live: false,
    title: "SEO data",
    body: "Search Console, Bing, PageSpeed and site crawls, with opportunities and content decay."
  },
  {
    status: "Early access",
    live: false,
    title: "AI visibility",
    body: "What ChatGPT and Gemini tell your customers, and who they cite."
  },
  {
    status: "Early access",
    live: false,
    title: "Ads",
    body: "Meta and Google campaigns with copy, images and a landing page. Always paused until you approve."
  }
];

const heading = "font-display text-4xl font-bold leading-tight tracking-tight";
const wrap = "mx-auto max-w-[1180px] px-6";

type HomePageProps = {
  searchParams?: Promise<{ error?: string; plan?: string }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const session = await auth();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const plan = isPlanId(resolvedSearchParams?.plan) ? resolvedSearchParams.plan : null;

  // A plan link is an explicit request for this page, so it wins over the jump to the workspace.
  if (session?.user?.id && !plan) {
    const workspace = await prisma.workspace.findUnique({
      where: { ownerId: session.user.id },
      select: {
        sites: {
          orderBy: { createdAt: "asc" },
          select: { id: true }
        }
      }
    });

    redirect(workspace?.sites[0]?.id ? `/${workspace.sites[0].id}` : "/settings");
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
          <a href="#access" className="rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800">
            Get access
          </a>
        </nav>
      </header>

      {resolvedSearchParams?.error === "access_limited" ? (
        <div className={wrap}>
          <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Access is limited for now. Join the waitlist and we'll let you know.
          </p>
        </div>
      ) : null}

      <section className={`${wrap} grid items-center gap-9 pb-[88px] pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14`}>
        <div>
          <p className="mb-4 text-[15px] font-semibold text-accent">For small businesses and agencies</p>
          <h1 className="font-display text-[40px] font-bold leading-[1.05] tracking-tight md:text-[60px]">
            Get found on Google, in AI answers and through ads.
          </h1>
          <p className="mt-5 max-w-[560px] text-[19px] text-slate-600">
            DIYSEO finds the searches you're missing, publishes the content your website lacks and turns what works into
            ad campaigns. All in one place.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#access" className="rounded-lg bg-accent px-5 py-3.5 font-semibold text-white transition hover:bg-teal-800">
              Get access
            </a>
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

      <section id="access" className={`${wrap} relative scroll-mt-4 py-20`}>
        <div className="max-w-[620px]">
          <h2 className={heading}>We're opening places gradually</h2>
          <p className="mt-3 text-lg text-slate-600">Leave your email and we'll tell you when your place is ready. No commitment.</p>
          <WaitlistForm key={plan ?? "none"} defaultPlan={plan} />
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
