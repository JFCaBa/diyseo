import Link from "next/link";

export const metadata = {
  title: "Privacy Policy",
  description: "Privacy Policy for DIYSEO early access."
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-sand/40 px-4 py-10 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-3xl rounded-[2rem] border border-line bg-white px-5 py-7 shadow-panel sm:px-8 md:px-10 md:py-10">
        <Link
          href="/"
          className="inline-flex text-sm font-semibold text-accent underline-offset-4 transition hover:text-teal-700 hover:underline"
        >
          ← Back to Home
        </Link>

        <div className="mt-6 space-y-6">
          <div className="space-y-3 border-b border-line pb-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-accent">Legal</p>
            <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Privacy Policy</h1>
            <p className="max-w-2xl text-base leading-8 text-slate-600">
              DIYSEO is an early-access SaaS. This page explains the basic data we collect, why we use it, and how we
              handle it.
            </p>
          </div>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-ink">What data we collect</h2>
            <p className="text-base leading-8 text-slate-600">
              We collect the Google account email used to sign in, along with workspace and product data you create in
              the app, including sites, articles, keywords, settings, and related content workflow data.
            </p>
            <p className="text-base leading-8 text-slate-600">
              If you connect Google Search Console, we also access read-only Search Console property and performance
              data needed to show SEO analytics inside the product.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-ink">How we use data</h2>
            <p className="text-base leading-8 text-slate-600">
              We use account data to authenticate you, create and secure your workspace, and provide access to the
              product. We use workspace and content data to operate article, keyword, publishing, blog, widget, and
              analytics features.
            </p>
            <p className="text-base leading-8 text-slate-600">
              Search Console data is used only to display connected search performance inside your workspace and to
              support future SEO reporting features.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-ink">Data sharing</h2>
            <p className="text-base leading-8 text-slate-600">
              We do not sell personal data. We do not use Google user data for advertising. Data may be processed by
              infrastructure and service providers needed to host and operate the app.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-ink">Storage and retention</h2>
            <p className="text-base leading-8 text-slate-600">
              Data is stored in the application database and related hosting infrastructure used to run DIYSEO. We keep
              data for as long as needed to operate the service, comply with legal obligations, and handle support or
              security issues.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-ink">Access, deletion, and contact</h2>
            <p className="text-base leading-8 text-slate-600">
              You can request account or workspace deletion, or ask questions about privacy, by contacting:
              <span className="font-semibold text-ink"> privacy@yourdomain.com</span>
            </p>
            <p className="text-base leading-8 text-slate-600">
              This is a placeholder contact address and should be replaced with a real support or privacy email before
              production use.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
