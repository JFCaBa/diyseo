import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth, signIn } from "@/lib/auth";
import { safeLoginNext } from "@/lib/sso/authorize";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
  referrer: "no-referrer"
};

type SsoLoginPageProps = { searchParams?: Promise<{ next?: string | string[] }> };

export default async function SsoLoginPage({ searchParams }: SsoLoginPageProps) {
  const query = searchParams ? await searchParams : undefined;
  const next = safeLoginNext(typeof query?.next === "string" ? query.next : null);
  const session = await auth();

  if (session?.user?.id) {
    redirect(next);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-10 sm:px-6">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">DIYSEO</p>
      <h1 className="mt-2 text-2xl font-semibold text-ink">Sign in to continue</h1>
      <p className="mt-2 text-sm text-slate-600">Use your DIYSEO account to open this service.</p>
      <form
        className="mt-6"
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: next });
        }}
      >
        <button
          type="submit"
          className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-ink px-5 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Continue with Google
        </button>
      </form>
    </main>
  );
}
