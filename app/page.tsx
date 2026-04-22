import Link from "next/link";

import { SignInButton, SignOutButton } from "@/components/auth-buttons";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const features = [
  {
    title: "AI article generation",
    description: "Generate SEO-ready drafts from a keyword and your site context."
  },
  {
    title: "Brand-aware content",
    description: "Keep language, tone, themes, and visual direction consistent."
  },
  {
    title: "Public API",
    description: "Serve published articles through stable site-specific endpoints."
  },
  {
    title: "Embeddable widget",
    description: "Render articles on any page with a single script snippet."
  },
  {
    title: "Self-hosted",
    description: "Run the product on your own stack with your own database."
  },
  {
    title: "No vendor lock-in",
    description: "Keep your content, routes, and publishing flow under your control."
  }
];

const steps = [
  {
    title: "Create a site",
    description: "Set up a website, domain, and content language in the admin."
  },
  {
    title: "Generate articles",
    description: "Use Brand DNA and AI generation to create and edit drafts quickly."
  },
  {
    title: "Embed on your website",
    description: "Publish through the built-in blog or drop the widget into any page."
  }
];

const embedSnippet = `<script async src="/embed.js" data-site="demo" data-base-path="/blog"></script>`;

export default async function HomePage() {
  const session = await auth();
  const workspace = session?.user?.id
    ? await prisma.workspace.findUnique({
        where: { ownerId: session.user.id },
        select: {
          sites: {
            orderBy: { createdAt: "asc" },
            select: { id: true }
          }
        }
      })
    : null;
  const startHref = workspace?.sites[0]?.id ? `/${workspace.sites[0].id}` : "/settings";

  return (
    <main className="min-h-screen">
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-8">
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
                Start using
              </Link>
            ) : (
              <SignInButton
                className="inline-flex items-center justify-center rounded-2xl border border-line bg-white/80 px-4 py-2 text-sm font-semibold text-ink transition hover:bg-white"
                label="Sign in with Google"
              />
            )}
            <Link
              href="/blog/widget-demo"
              className="inline-flex items-center justify-center rounded-2xl px-4 py-2 text-sm font-semibold text-slate-600 transition hover:text-ink"
            >
              View demo
            </Link>
            {session?.user ? <SignOutButton /> : null}
          </nav>
        </header>

        <section className="grid gap-12 pb-24 pt-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="space-y-8">
            <div className="space-y-5">
              <p className="text-sm font-semibold text-accent">Self-hosted. No lock-in.</p>
              <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-ink sm:text-6xl">
                Run your own AI blog engine
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-600">
                Generate brand-aware SEO articles, publish them through your own blog, and embed them anywhere
                with one script.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              {session?.user ? (
                <Link
                  href={startHref}
                  className="inline-flex items-center justify-center rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Start using
                </Link>
              ) : (
                <SignInButton />
              )}
              <Link
                href="/blog/widget-demo"
                className="inline-flex items-center justify-center rounded-2xl border border-line bg-white/80 px-5 py-3 text-sm font-semibold text-ink transition hover:bg-white"
              >
                View demo
              </Link>
            </div>
          </div>

          <div className="rounded-[2rem] border border-line bg-white/85 p-5 shadow-panel">
            <div className="rounded-[1.5rem] border border-line bg-ink px-4 py-3 text-xs font-medium text-slate-300">
              widget.tsx
            </div>
            <div className="mt-4 space-y-4 rounded-[1.5rem] border border-line bg-sand/70 p-5">
              <pre className="overflow-x-auto text-sm leading-7 text-ink">
                <code>{embedSnippet}</code>
              </pre>
              <div className="rounded-[1.25rem] border border-line bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-ink">Published Articles</p>
                    <p className="mt-1 text-sm text-slate-500">Rendered from the existing public API</p>
                  </div>
                  <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
                    Widget
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl border border-line px-4 py-3">
                    <p className="font-semibold text-ink">Planning a Simple Editorial Calendar</p>
                    <p className="mt-1 text-sm text-slate-600">
                      Start with a small set of themes, match them to audience intent, and publish on a cadence.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-line px-4 py-3">
                    <p className="font-semibold text-ink">How To Structure a Brand DNA Brief</p>
                    <p className="mt-1 text-sm text-slate-600">
                      Give AI and editors the same operating context before you publish.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-10 border-t border-line py-20 lg:grid-cols-2">
          <div className="space-y-5">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">Problem</p>
            <h2 className="text-3xl font-semibold tracking-tight text-ink">Content is slow. SEO is harder.</h2>
            <ul className="space-y-3 text-base text-slate-600">
              <li>Writing takes time</li>
              <li>Tools are fragmented</li>
              <li>Content doesn&apos;t scale</li>
            </ul>
          </div>
          <div className="space-y-5">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">Solution</p>
            <h2 className="text-3xl font-semibold tracking-tight text-ink">DIYSEO fixes that</h2>
            <ul className="space-y-3 text-base text-slate-600">
              <li>Generate articles instantly</li>
              <li>Manage everything in one place</li>
              <li>Publish anywhere with a snippet</li>
            </ul>
          </div>
        </section>

        <section className="border-t border-line py-20">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">Features</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink">Built for a simple publishing loop</h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {features.map((feature) => (
              <div key={feature.title} className="rounded-3xl border border-line bg-white/85 p-6 shadow-panel">
                <h3 className="text-lg font-semibold text-ink">{feature.title}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-line py-20">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">How It Works</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink">Three steps to live content</h2>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {steps.map((step, index) => (
              <div key={step.title} className="rounded-3xl border border-line bg-white/85 p-6 shadow-panel">
                <p className="text-sm font-semibold text-accent">0{index + 1}</p>
                <h3 className="mt-3 text-lg font-semibold text-ink">{step.title}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">{step.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-line py-20">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">Live Example</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-ink">Drop the widget into your site</h2>
              <p className="mt-4 max-w-xl text-base leading-8 text-slate-600">
                Use the existing public API and widget to publish articles outside the admin without changing your
                site architecture.
              </p>
              <Link
                href="/blog/widget-demo"
                className="mt-6 inline-flex items-center justify-center rounded-2xl border border-line bg-white/80 px-5 py-3 text-sm font-semibold text-ink transition hover:bg-white"
              >
                Open widget demo
              </Link>
            </div>

            <div className="rounded-[2rem] border border-line bg-white/85 p-6 shadow-panel">
              <pre className="overflow-x-auto rounded-[1.5rem] border border-line bg-ink p-5 text-sm leading-7 text-slate-200">
                <code>{embedSnippet}</code>
              </pre>
            </div>
          </div>
        </section>

        <section className="border-t border-line py-20">
          <div className="rounded-[2rem] border border-line bg-ink px-8 py-10 text-white shadow-panel">
            <div className="max-w-3xl space-y-4">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-300">Start</p>
              <h2 className="text-4xl font-semibold tracking-tight">Start your own AI blog today</h2>
              <p className="max-w-2xl text-base leading-8 text-slate-300">
                Run the admin, generate articles, publish to your own blog routes, and embed content anywhere you
                need it.
              </p>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              {session?.user ? (
                <Link
                  href={startHref}
                  className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:bg-slate-100"
                >
                  Start using
                </Link>
              ) : (
                <SignInButton
                  className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:bg-slate-100"
                  label="Sign in with Google"
                />
              )}
              <Link
                href="/blog/widget-demo"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-900"
              >
                View demo
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
                Start using
              </Link>
            ) : (
              <span>Sign in with Google</span>
            )}
            <Link href="/blog/widget-demo" className="transition hover:text-ink">
              Demo
            </Link>
            <Link href="/blog" className="transition hover:text-ink">
              Blog
            </Link>
          </div>
        </footer>
      </section>
    </main>
  );
}
