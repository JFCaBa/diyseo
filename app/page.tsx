import Link from "next/link";
import { redirect } from "next/navigation";

import { SignInButton, SignOutButton } from "@/components/auth-buttons";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const capabilities = [
  {
    title: "Brand-aware generation",
    description: "Use Brand DNA to generate a first draft that already matches tone, audience, and topic direction."
  },
  {
    title: "Draft to publish workflow",
    description: "Edit, review, assign keywords, and publish articles through the same lightweight admin flow."
  },
  {
    title: "Open public delivery",
    description: "Keep your public blog, public API, RSS, sitemap, and widget available without extra integration work."
  },
  {
    title: "Embed anywhere",
    description: "Drop the widget into an existing site and render published content without changing your architecture."
  },
  {
    title: "Self-hosted control",
    description: "Run the app on your own stack with your own database, routes, and deployment setup."
  },
  {
    title: "Google sign-in to workspace",
    description: "Log in, land in your workspace, and go straight into the first-use onboarding path."
  }
];

const steps = [
  {
    number: "01",
    title: "Connect your site",
    description: "Create your workspace and start with a site that will power the blog, API, and widget."
  },
  {
    number: "02",
    title: "Generate article",
    description: "Use AI plus Brand DNA to turn an idea into a draft quickly."
  },
  {
    number: "03",
    title: "Publish it",
    description: "Push one article live so your public blog has real content immediately."
  },
  {
    number: "04",
    title: "Embed widget",
    description: "Drop one snippet into your site and render the live blog anywhere."
  }
];

const proofPoints = [
  "API-first",
  "Widget-ready",
  "Self-hostable"
];

type HomePageProps = {
  searchParams?: Promise<{ error?: string }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const session = await auth();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  if (session?.user?.id) {
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

  const startHref = "/settings";

  return (
    <main className="min-h-screen">
      <section className="mx-auto max-w-5xl px-6 pb-20 pt-6">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="text-sm font-semibold uppercase tracking-[0.28em] text-accent">
            DIYSEO
          </Link>
          <nav className="flex items-center gap-3">
            {session?.user ? (
              <Link
                href={startHref}
                className="inline-flex items-center justify-center rounded-2xl border border-line bg-white/80 px-4 py-2 text-sm font-semibold text-ink transition hover:bg-white"
              >
                Open workspace
              </Link>
            ) : (
              <SignInButton
                className="inline-flex items-center justify-center rounded-2xl border border-line bg-white/80 px-4 py-2 text-sm font-semibold text-ink transition hover:bg-white"
                label="Sign in with Google"
              />
            )}
            {session?.user ? <SignOutButton /> : null}
          </nav>
        </header>

        {resolvedSearchParams?.error === "access_limited" ? (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Access is currently limited. Contact us for access.
          </div>
        ) : null}

        <section className="flex justify-center pb-20 pt-12 lg:min-h-[68vh] lg:items-center">
          <div className="max-w-3xl space-y-7">
            <div className="space-y-4">
              <p className="text-sm font-semibold text-accent">Self-hosted SEO workflow</p>
              <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-ink sm:text-6xl">
                Launch an AI blog on any website
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-600">
                Generate SEO articles, publish them, and embed a live blog with one snippet.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              {session?.user ? (
                <Link
                  href={startHref}
                  className="inline-flex items-center justify-center rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Open workspace
                </Link>
              ) : (
                <SignInButton label="Sign in with Google" />
              )}
              <Link
                href="#how-it-works"
                className="inline-flex items-center justify-center rounded-2xl border border-line bg-white/80 px-5 py-3 text-sm font-semibold text-ink transition hover:bg-white"
              >
                See how it works
              </Link>
            </div>

            <div className="flex flex-wrap gap-2">
              {proofPoints.map((item) => (
                <span key={item} className="rounded-full border border-line bg-white/80 px-3 py-1 text-xs font-semibold text-slate-600">
                  {item}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="border-t border-line py-20 scroll-mt-24">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">How It Works</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink">A simple path from content to distribution</h2>
            <p className="mt-4 text-base leading-8 text-slate-600">
              DIYSEO combines article generation, publishing, and a public blog widget in one product flow that is easy
              to understand quickly.
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {steps.map((step) => (
              <div key={step.number} className="rounded-3xl border border-line bg-white/85 p-6 shadow-panel">
                <p className="text-sm font-semibold text-accent">{step.number}</p>
                <h3 className="mt-3 text-lg font-semibold text-ink">{step.title}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">{step.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-line py-20">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">Capabilities</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink">Built for a practical content workflow</h2>
            <p className="mt-4 text-base leading-8 text-slate-600">
              Everything here is based on what the product already does today. The message is tighter, but the promise
              stays honest.
            </p>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {capabilities.map((capability) => (
              <div key={capability.title} className="rounded-3xl border border-line bg-white/85 p-6 shadow-panel">
                <h3 className="text-lg font-semibold text-ink">{capability.title}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">{capability.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-line py-20">
          <div className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">Why It Feels Credible</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink">No abstract funnel. Just a working loop.</h2>
              <p className="mt-4 max-w-xl text-base leading-8 text-slate-600">
                The homepage now points to the same progression users take inside the product, so the marketing message
                does not drift away from the actual onboarding experience.
              </p>
            </div>

            <div className="rounded-[2rem] border border-line bg-white/85 p-6 shadow-panel">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-line px-4 py-4">
                  <p className="text-sm text-slate-500">Input</p>
                  <p className="mt-2 font-semibold text-ink">Brand DNA + article generation</p>
                </div>
                <div className="rounded-2xl border border-line px-4 py-4">
                  <p className="text-sm text-slate-500">Output</p>
                  <p className="mt-2 font-semibold text-ink">Public article + widget-ready content</p>
                </div>
                <div className="rounded-2xl border border-line px-4 py-4">
                  <p className="text-sm text-slate-500">Access</p>
                  <p className="mt-2 font-semibold text-ink">Google sign-in and owned workspace</p>
                </div>
                <div className="rounded-2xl border border-line px-4 py-4">
                  <p className="text-sm text-slate-500">Delivery</p>
                  <p className="mt-2 font-semibold text-ink">Blog, API, feeds, sitemap, and embed</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-line py-20">
          <div className="rounded-[2rem] border border-line bg-ink px-8 py-10 text-white shadow-panel">
            <div className="max-w-3xl space-y-4">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-300">Start</p>
              <h2 className="text-4xl font-semibold tracking-tight">Launch an AI blog without rebuilding your site</h2>
              <p className="max-w-2xl text-base leading-8 text-slate-300">
                Sign in with Google, generate your first article, publish it, and embed the live blog when you are ready.
              </p>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              {session?.user ? (
                <Link
                  href={startHref}
                  className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:bg-slate-100"
                >
                  Open workspace
                </Link>
              ) : (
                <SignInButton
                  className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:bg-slate-100"
                  label="Sign in with Google"
                />
              )}
              <Link
                href="#how-it-works"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-900"
              >
                See how it works
              </Link>
            </div>
          </div>
        </section>

        <footer className="flex flex-col gap-5 border-t border-line py-10 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-4">
            <a
              href="https://github.com/JFCaBa/diyseo"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-ink transition hover:text-accent"
            >
              GitHub
            </a>
            <span>Self-hosted</span>
            <span>Open source</span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {session?.user ? (
              <Link href={startHref} className="transition hover:text-ink">
                Open workspace
              </Link>
            ) : (
              <span>Sign in with Google</span>
            )}
            <Link href="#how-it-works" className="transition hover:text-ink">
              How it works
            </Link>
            <Link href="/blog" className="transition hover:text-ink">
              Blog
            </Link>
            <Link href="/privacy" className="transition hover:text-ink">
              Privacy
            </Link>
            <Link href="/terms" className="transition hover:text-ink">
              Terms
            </Link>
          </div>
        </footer>
      </section>
    </main>
  );
}
