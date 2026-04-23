import Link from "next/link";

export const metadata = {
  title: "Terms of Service",
  description: "Terms of Service for DIYSEO early access."
};

export default function TermsPage() {
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
            <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Terms of Service</h1>
            <p className="max-w-2xl text-base leading-8 text-slate-600">
              DIYSEO is offered as an early-access product. These terms set the basic expectations for use.
            </p>
          </div>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-ink">Early access</h2>
            <p className="text-base leading-8 text-slate-600">
              The service is still evolving. Features may change, be incomplete, or become unavailable without notice.
              You should evaluate outputs and workflows before relying on them in production.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-ink">Acceptable use</h2>
            <p className="text-base leading-8 text-slate-600">
              You may not use the service to violate laws, infringe rights, abuse third-party platforms, interfere with
              the service, or attempt unauthorized access to accounts, systems, or data.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-ink">No guarantees</h2>
            <p className="text-base leading-8 text-slate-600">
              The service is provided on an “as is” and “as available” basis. We do not guarantee uptime, accuracy,
              fitness for a particular purpose, or uninterrupted access.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-ink">Limitation of liability</h2>
            <p className="text-base leading-8 text-slate-600">
              To the maximum extent permitted by law, DIYSEO and its operators are not liable for indirect, incidental,
              special, consequential, or business interruption damages arising from your use of the service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-ink">Termination and access removal</h2>
            <p className="text-base leading-8 text-slate-600">
              We may suspend or remove access at any time, including during early access, if needed for security,
              product changes, policy enforcement, or operational reasons.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-ink">Contact</h2>
            <p className="text-base leading-8 text-slate-600">
              Questions about these terms can be sent to:
              <span className="font-semibold text-ink"> legal@yourdomain.com</span>
            </p>
            <p className="text-base leading-8 text-slate-600">
              This is a placeholder contact address and should be replaced with a real legal or support email before
              production use.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
