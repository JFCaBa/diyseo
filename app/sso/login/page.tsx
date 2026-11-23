import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getT } from "@/lib/i18n/server";
import { auth, signIn } from "@/lib/auth";
import { safeLoginNext } from "@/lib/sso/authorize";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("onboarding.signIn"),
    robots: { index: false, follow: false },
    referrer: "no-referrer"
  };
}

type SsoLoginPageProps = { searchParams?: Promise<{ next?: string | string[] }> };

export default async function SsoLoginPage({ searchParams }: SsoLoginPageProps) {
  const query = searchParams ? await searchParams : undefined;
  const next = safeLoginNext(typeof query?.next === "string" ? query.next : null);
  const session = await auth();
  const t = await getT();

  if (session?.user?.id) {
    redirect(next);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-10 sm:px-6">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">DIYSEO</p>
      <h1 className="mt-2 text-2xl font-semibold text-ink">{t("onboarding.ssoTitle")}</h1>
      <p className="mt-2 text-sm text-slate-600">{t("onboarding.ssoBody")}</p>
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
          {t("onboarding.continueWithGoogle")}
        </button>
      </form>
    </main>
  );
}
