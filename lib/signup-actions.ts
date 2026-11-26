"use server";

import { cookies } from "next/headers";

import { signIn } from "@/lib/auth";
import { uiLocaleCookie, type UiLocale } from "@/lib/i18n/locale";

/** Landing CTAs: Google sign-in, then the workspace. Plans are chosen later in /billing. */
export async function startFreeTrial() {
  await signIn("google", { redirectTo: "/auth/continue" });
}

async function startFreeTrialIn(locale: UiLocale) {
  const cookie = uiLocaleCookie(locale, process.env.NODE_ENV === "production")!;
  (await cookies()).set(cookie.name, cookie.value, cookie.options);
  await signIn("google", { redirectTo: "/auth/continue" });
}

/** The `/es` CTAs: the app starts in Spanish (and so bills new customers in euros). */
export async function startFreeTrialEs() {
  await startFreeTrialIn("es");
}

/** The `/pt` CTAs: the app starts in Portuguese (euros too). */
export async function startFreeTrialPt() {
  await startFreeTrialIn("pt");
}
